import { Prisma, type Product, type StockLot, type StockMovement, type StockLossReason } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type LossProduct = Pick<Product, 'id' | 'name' | 'unit' | 'stockMode'>;
export interface StockLossUnitOfWork {
  lockProduct(id: string): Promise<LossProduct | null>;
  getBalance(productId: string): Promise<Prisma.Decimal | null>;
  getLot(productId: string, lotId: string): Promise<StockLot | null>;
  decrementBalance(productId: string, quantity: Prisma.Decimal): Promise<void>;
  decrementLot(lotId: string, quantity: Prisma.Decimal): Promise<void>;
  findActiveReason(id: string): Promise<StockLossReason | null>;
  createMovement(data: { productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; reasonId?: string; observations?: string; actorUserId: string }): Promise<StockMovement>;
  audit(data: { actorUserId: string; ipAddress?: string; productId: string; productName: string; reason: string; quantity: string; lotId?: string; movementId: string }): Promise<void>;
}

export interface StockLossRepository {
  transaction<T>(operation: (work: StockLossUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaStockLossRepository implements StockLossRepository {
  constructor(private readonly auditService: AuditService) {}

  transaction<T>(operation: (work: StockLossUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => operation({
      lockProduct: async (id) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${id}::uuid FOR UPDATE`;
        return rows.length ? tx.product.findUnique({ where: { id }, select: { id: true, name: true, unit: true, stockMode: true } }) : null;
      },
      getBalance: async (productId) => {
        await tx.$queryRaw`SELECT "id" FROM "stock_balances" WHERE "product_id" = ${productId}::uuid FOR UPDATE`;
        return (await tx.stockBalance.findUnique({ where: { productId }, select: { quantity: true } }))?.quantity ?? null;
      },
      getLot: async (productId, lotId) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "stock_lots" WHERE "id" = ${lotId}::uuid AND "product_id" = ${productId}::uuid FOR UPDATE`;
        return rows.length ? tx.stockLot.findUnique({ where: { id: lotId } }) : null;
      },
      decrementBalance: async (productId, quantity) => {
        const result = await tx.stockBalance.updateMany({ where: { productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        if (result.count !== 1) throw new Error('INSUFFICIENT_STOCK');
      },
      decrementLot: async (lotId, quantity) => {
        const result = await tx.stockLot.updateMany({ where: { id: lotId, currentQuantity: { gte: quantity } }, data: { currentQuantity: { decrement: quantity } } });
        if (result.count !== 1) throw new Error('INSUFFICIENT_STOCK');
      },
      findActiveReason: (id) => tx.stockLossReason.findFirst({ where: { id, isActive: true } }),
      createMovement: (data) => tx.stockMovement.create({ data: { productId: data.productId, lotId: data.lotId, quantity: data.quantity, type: 'LOSS', reason: data.reason, stockLossReasonId: data.reasonId, observations: data.observations, actorUserId: data.actorUserId } }),
      audit: ({ actorUserId, ipAddress, productId, productName, reason, quantity, lotId, movementId }) => this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'STOCK_LOSS_RECORDED', after: { productId, productName, reason, quantity, lotId: lotId ?? null, movementId }, entity: 'StockMovement', entityId: movementId, ipAddress }, tx),
    }));
  }
}

export interface LossReasonAdminRepository {
  list(activeOnly?: boolean): Promise<StockLossReason[]>;
  create(name: string, actorUserId: string, ipAddress?: string): Promise<StockLossReason>;
  update(id: string, data: { name?: string; isActive?: boolean }, actorUserId: string, ipAddress?: string): Promise<StockLossReason>;
}

export class PrismaLossReasonAdminRepository implements LossReasonAdminRepository {
  constructor(private readonly auditService: AuditService) {}
  list(activeOnly = false): Promise<StockLossReason[]> { return prisma.stockLossReason.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: [{ name: 'asc' }] }); }
  create(name: string, actorUserId: string, ipAddress?: string): Promise<StockLossReason> {
    return prisma.$transaction(async (tx) => {
      const reason = await tx.stockLossReason.create({ data: { name, createdByUserId: actorUserId } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'STOCK_LOSS_REASON_CREATED', after: reason, entity: 'StockLossReason', entityId: reason.id, ipAddress }, tx);
      return reason;
    });
  }
  update(id: string, data: { name?: string; isActive?: boolean }, actorUserId: string, ipAddress?: string): Promise<StockLossReason> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.stockLossReason.findUnique({ where: { id } });
      if (!before) throw new Error('LOSS_REASON_NOT_FOUND');
      const reason = await tx.stockLossReason.update({ where: { id }, data });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'STOCK_LOSS_REASON_UPDATED', before, after: reason, entity: 'StockLossReason', entityId: id, ipAddress }, tx);
      return reason;
    });
  }
}
