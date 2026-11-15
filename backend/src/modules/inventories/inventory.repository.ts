import { Prisma, type InventoryItem, type Product, type StockMovement, type StockLot } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { CreateInventoryInput } from './inventory.schemas.js';

const inventoryInclude = {
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, stockMode: true } },
      lot: { select: { id: true, identifier: true, expirationDate: true } },
    },
    orderBy: [{ product: { name: 'asc' as const } }, { lot: { identifier: 'asc' as const } }, { id: 'asc' as const }],
  },
} satisfies Prisma.InventoryInclude;

export type InventoryDetail = Prisma.InventoryGetPayload<{ include: typeof inventoryInclude }> & { movements: StockMovement[] };
export type InventoryCountTarget = { status: 'EM_ANDAMENTO' | 'AGUARDANDO_CONFERENCIA' | 'CONFIRMADO' | 'CANCELADO'; unit: Product['unit'] };

export interface InventoryRepository {
  create(data: CreateInventoryInput, actorUserId: string, ipAddress?: string): Promise<InventoryDetail>;
  list(page: number, pageSize: number): Promise<{ inventories: Array<Prisma.InventoryGetPayload<{ include: { createdBy: { select: { name: true } }; _count: { select: { items: true } } } }>>; total: number }>;
  findById(id: string): Promise<InventoryDetail | null>;
  findCountTarget(inventoryId: string, itemId: string): Promise<InventoryCountTarget | null>;
  recordCount(inventoryId: string, itemId: string, quantity: Prisma.Decimal, actorUserId: string, ipAddress?: string): Promise<InventoryItem>;
  submitForReview(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void>;
  confirm(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void>;
  cancel(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void>;
}

function auditItems(items: Array<{ productId: string; lotId: string | null; snapshotQuantity: Prisma.Decimal }>) {
  return items.map((item) => ({ productId: item.productId, lotId: item.lotId, snapshotQuantity: item.snapshotQuantity.toString() }));
}

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly auditService: AuditService) {}

  create(data: CreateInventoryInput, actorUserId: string, ipAddress?: string): Promise<InventoryDetail> {
    return prisma.$transaction(async (tx) => {
      const selection = data.type === 'COMPLETE' ? {} : {
        OR: [
          ...(data.productIds.length ? [{ id: { in: data.productIds } }] : []),
          ...(data.categoryIds.length ? [{ categoryId: { in: data.categoryIds } }] : []),
        ],
      };
      const candidates = await tx.product.findMany({ where: selection, select: { id: true }, orderBy: { id: 'asc' } });
      const candidateIds = candidates.map(({ id }) => id);
      if (candidateIds.length === 0) throw new Error('INVENTORY_NO_PRODUCTS');
      const found = new Set(candidateIds);
      if (data.type === 'PARTIAL' && data.productIds.some((id) => !found.has(id))) throw new Error('INVENTORY_PRODUCT_NOT_FOUND');
      if (data.type === 'PARTIAL' && data.categoryIds.length) {
        const categoryCount = await tx.category.count({ where: { id: { in: data.categoryIds } } });
        if (categoryCount !== data.categoryIds.length) throw new Error('INVENTORY_CATEGORY_NOT_FOUND');
      }

      for (const id of candidateIds) await tx.$queryRaw`SELECT "id" FROM "products" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const products = await tx.product.findMany({
        where: { id: { in: candidateIds } },
        include: { stockBalance: { select: { quantity: true } }, stockLots: { orderBy: [{ identifier: 'asc' }, { id: 'asc' }] } },
        orderBy: { id: 'asc' },
      });
      const startedAt = new Date();
      const inventory = await tx.inventory.create({ data: { type: data.type, status: 'EM_ANDAMENTO', observations: data.observations, startedAt, createdById: actorUserId } });
      const snapshotItems = products.flatMap((product) => {
        if (product.stockMode === 'SIMPLES') return [{ inventoryId: inventory.id, productId: product.id, snapshotQuantity: product.stockBalance?.quantity ?? new Prisma.Decimal(0) }];
        if (product.stockLots.length === 0) return [{ inventoryId: inventory.id, productId: product.id, snapshotQuantity: new Prisma.Decimal(0) }];
        return product.stockLots.map((lot) => ({ inventoryId: inventory.id, productId: product.id, lotId: lot.id, snapshotQuantity: lot.currentQuantity }));
      });
      await tx.inventoryItem.createMany({ data: snapshotItems });
      const result = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id }, include: inventoryInclude });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_CREATED', after: { id: result.id, type: result.type, status: result.status, startedAt: result.startedAt.toISOString(), observations: result.observations, items: auditItems(result.items) }, entity: 'Inventory', entityId: result.id, ipAddress }, tx);
      return { ...result, movements: [] };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async list(page: number, pageSize: number) {
    const [inventories, total] = await prisma.$transaction([
      prisma.inventory.findMany({ include: { createdBy: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.inventory.count(),
    ]);
    return { inventories, total };
  }

  async findById(id: string): Promise<InventoryDetail | null> {
    let inventory = await prisma.inventory.findUnique({ where: { id }, include: inventoryInclude });
    if (!inventory) return null;
    let movements = await prisma.stockMovement.findMany({ where: { productId: { in: [...new Set(inventory.items.map((item) => item.productId))] }, createdAt: { gt: inventory.startedAt } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

    if (inventory.status === 'EM_ANDAMENTO') {
      const selectedProductIds = new Set(inventory.items.map((item) => item.productId));
      const knownLotIds = new Set(inventory.items.flatMap((item) => item.lotId ? [item.lotId] : []));
      const newLotIds = [...new Set(movements.flatMap((movement) => movement.lotId && !knownLotIds.has(movement.lotId) ? [movement.lotId] : []))];
      if (newLotIds.length) {
        const newLots: StockLot[] = await prisma.stockLot.findMany({ where: { id: { in: newLotIds }, productId: { in: [...selectedProductIds] } } });
        if (newLots.length) {
          await prisma.inventoryItem.createMany({ data: newLots.map((lot) => ({ inventoryId: inventory!.id, productId: lot.productId, lotId: lot.id, snapshotQuantity: new Prisma.Decimal(0) })), skipDuplicates: true });
          inventory = await prisma.inventory.findUniqueOrThrow({ where: { id }, include: inventoryInclude });
        }
      }
    }
    return { ...inventory, movements };
  }

  async findCountTarget(inventoryId: string, itemId: string): Promise<InventoryCountTarget | null> {
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, inventoryId }, select: { inventory: { select: { status: true } }, product: { select: { unit: true } } } });
    return item ? { status: item.inventory.status, unit: item.product.unit } : null;
  }

  recordCount(inventoryId: string, itemId: string, quantity: Prisma.Decimal, actorUserId: string, ipAddress?: string): Promise<InventoryItem> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "inventories" WHERE "id" = ${inventoryId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw new Error('INVENTORY_NOT_FOUND');
      const inventory = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { status: true } });
      if (inventory.status !== 'EM_ANDAMENTO') throw new Error('INVENTORY_NOT_OPEN');
      const before = await tx.inventoryItem.findFirst({ where: { id: itemId, inventoryId } });
      if (!before) throw new Error('INVENTORY_ITEM_NOT_FOUND');
      const updated = await tx.inventoryItem.update({ where: { id: itemId }, data: { countedQuantity: quantity, countedAt: new Date() } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_ITEM_COUNTED', before: { id: before.id, productId: before.productId, lotId: before.lotId, countedQuantity: before.countedQuantity?.toString() ?? null }, after: { id: updated.id, productId: updated.productId, lotId: updated.lotId, countedQuantity: quantity.toString() }, entity: 'InventoryItem', entityId: updated.id, ipAddress }, tx);
      return updated;
    });
  }

  submitForReview(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "inventories" WHERE "id" = ${inventoryId}::uuid FOR UPDATE`;
      if (!rows.length) throw new Error('INVENTORY_NOT_FOUND');
      const inventory = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, include: { items: { select: { id: true, countedQuantity: true } } } });
      if (inventory.status !== 'EM_ANDAMENTO') throw new Error('INVENTORY_INVALID_STATE');
      if (inventory.items.some((item) => item.countedQuantity === null)) throw new Error('INVENTORY_COUNTS_INCOMPLETE');
      await tx.inventory.update({ where: { id: inventoryId }, data: { status: 'AGUARDANDO_CONFERENCIA' } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_SUBMITTED_FOR_REVIEW', before: { status: inventory.status }, after: { status: 'AGUARDANDO_CONFERENCIA' }, entity: 'Inventory', entityId: inventoryId, ipAddress }, tx);
    });
  }

  confirm(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "inventories" WHERE "id" = ${inventoryId}::uuid FOR UPDATE`;
      if (!rows.length) throw new Error('INVENTORY_NOT_FOUND');
      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { id: inventoryId },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, unit: true, stockMode: true } } },
            orderBy: [{ productId: 'asc' }, { lotId: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (inventory.status !== 'AGUARDANDO_CONFERENCIA') throw new Error('INVENTORY_INVALID_STATE');
      if (inventory.items.some((item) => item.countedQuantity === null)) throw new Error('INVENTORY_COUNTS_INCOMPLETE');
      const productIds = [...new Set(inventory.items.map((item) => item.productId))].sort();
      for (const productId of productIds) await tx.$queryRaw`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`;
      const movements = await tx.stockMovement.findMany({ where: { productId: { in: productIds }, createdAt: { gt: inventory.startedAt } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      const directions: Record<string, number> = { ENTRY: 1, ADJUSTMENT_IN: 1, RETURN_IN: 1, REVERSAL_IN: 1, EXIT: -1, ADJUSTMENT_OUT: -1, LOSS: -1, RETURN_OUT: -1, REVERSAL_OUT: -1 };
      for (const item of inventory.items) {
        const delta = movements.filter((movement) => movement.productId === item.productId && (item.lotId ? movement.lotId === item.lotId : movement.lotId === null)).reduce((sum, movement) => sum.plus(movement.quantity.mul(directions[movement.type] ?? 0)), new Prisma.Decimal(0));
        const expected = item.snapshotQuantity.plus(delta);
        const counted = item.countedQuantity!;
        const adjustment = counted.minus(expected);
        if (adjustment.isZero()) continue;
        if (item.product.stockMode === 'LOTE' && !item.lotId) throw new Error('INVENTORY_LOT_REQUIRED');
        const type = adjustment.isPositive() ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        const quantity = adjustment.abs();
        let before: Prisma.Decimal;
        let after: Prisma.Decimal;
        if (item.lotId) {
          await tx.$queryRaw`SELECT "id" FROM "stock_lots" WHERE "id" = ${item.lotId}::uuid FOR UPDATE`;
          const lot = await tx.stockLot.findUnique({ where: { id: item.lotId }, select: { currentQuantity: true } });
          if (!lot) throw new Error('INVENTORY_LOT_NOT_FOUND');
          before = lot.currentQuantity;
          if (adjustment.isPositive()) await tx.stockLot.update({ where: { id: item.lotId }, data: { currentQuantity: { increment: quantity } } });
          else {
            const changed = await tx.stockLot.updateMany({ where: { id: item.lotId, currentQuantity: { gte: quantity } }, data: { currentQuantity: { decrement: quantity } } });
            if (changed.count !== 1) throw new Error('INVENTORY_STOCK_CONFLICT');
          }
          after = before.plus(adjustment);
        } else {
          await tx.$queryRaw`SELECT "id" FROM "stock_balances" WHERE "product_id" = ${item.productId}::uuid FOR UPDATE`;
          const balance = await tx.stockBalance.findUnique({ where: { productId: item.productId } });
          before = balance?.quantity ?? new Prisma.Decimal(0);
          if (adjustment.isPositive()) await tx.stockBalance.upsert({ where: { productId: item.productId }, create: { productId: item.productId, quantity }, update: { quantity: { increment: quantity } } });
          else {
            const changed = await tx.stockBalance.updateMany({ where: { productId: item.productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
            if (changed.count !== 1) throw new Error('INVENTORY_STOCK_CONFLICT');
          }
          after = before.plus(adjustment);
        }
        const movement = await tx.stockMovement.create({ data: { productId: item.productId, lotId: item.lotId, type, quantity, reason: `Ajuste do inventário ${inventoryId}`, actorUserId, createdAt: new Date() } });
        await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_STOCK_ADJUSTED', before: { productId: item.productId, lotId: item.lotId, quantity: before.toString() }, after: { productId: item.productId, lotId: item.lotId, quantity: after.toString(), movementId: movement.id, type, adjustment: quantity.toString() }, entity: 'StockMovement', entityId: movement.id, ipAddress }, tx);
      }
      await tx.inventory.update({ where: { id: inventoryId }, data: { status: 'CONFIRMADO', finishedAt: new Date() } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_CONFIRMED', before: { status: inventory.status }, after: { status: 'CONFIRMADO', itemCount: inventory.items.length }, entity: 'Inventory', entityId: inventoryId, ipAddress }, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  cancel(inventoryId: string, actorUserId: string, ipAddress?: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "inventories" WHERE "id" = ${inventoryId}::uuid FOR UPDATE`;
      if (!rows.length) throw new Error('INVENTORY_NOT_FOUND');
      const inventory = await tx.inventory.findUniqueOrThrow({ where: { id: inventoryId }, select: { status: true } });
      if (inventory.status !== 'EM_ANDAMENTO' && inventory.status !== 'AGUARDANDO_CONFERENCIA') throw new Error('INVENTORY_INVALID_STATE');
      await tx.inventory.update({ where: { id: inventoryId }, data: { status: 'CANCELADO', finishedAt: new Date() } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'INVENTORY_CANCELLED', before: { status: inventory.status }, after: { status: 'CANCELADO' }, entity: 'Inventory', entityId: inventoryId, ipAddress }, tx);
    });
  }
}
