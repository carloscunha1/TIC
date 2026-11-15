import { Prisma, type ProductStatus, type ProductUnit, type StockMode, type StockMovement, type StockLot, type StockBalance } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EntryWithItems } from './entry.repository.js';

export type ConfirmationEntry = Prisma.EntryGetPayload<{
  include: {
    supplier: { select: { id: true; status: true } };
    items: {
      include: { product: { select: { id: true; name: true; unit: true; stockMode: true; status: true; cost: true } } };
      orderBy: [{ position: 'asc' }, { id: 'asc' }];
    };
  };
}>;

export type ConfirmationProduct = { id: string; name: string; unit: ProductUnit; stockMode: StockMode; status: ProductStatus; cost: Prisma.Decimal };
export type ConfirmationMovementData = { productId: string; lotId?: string; quantity: Prisma.Decimal; actorUserId: string; reason: string };
export type NewStockLotData = { productId: string; identifier: string; expirationDate: Date | null; unitCost: Prisma.Decimal; quantity: Prisma.Decimal };

export interface EntryConfirmationUnitOfWork {
  lockEntry(id: string): Promise<ConfirmationEntry | null>;
  lockSupplier(id: string): Promise<{ status: string } | null>;
  lockProducts(ids: string[]): Promise<ConfirmationProduct[]>;
  increaseSimpleBalance(productId: string, quantity: Prisma.Decimal): Promise<StockBalance>;
  findLot(data: Pick<NewStockLotData, 'productId' | 'identifier' | 'expirationDate'>): Promise<StockLot | null>;
  createLot(data: NewStockLotData): Promise<StockLot>;
  addToLot(lotId: string, quantity: Prisma.Decimal, unitCost: Prisma.Decimal): Promise<StockLot>;
  createMovement(data: ConfirmationMovementData): Promise<StockMovement>;
  updateSimpleProductCost(productId: string, previous: Prisma.Decimal, next: Prisma.Decimal, actorUserId: string, entryId: string): Promise<void>;
  markConfirmed(entryId: string): Promise<boolean>;
  findEntry(id: string): Promise<EntryWithItems>;
  audit(event: { actorUserId: string; entryId: string; ipAddress?: string; before: unknown; after: unknown }): Promise<void>;
}

export interface EntryConfirmationRepository {
  transaction<T>(operation: (unitOfWork: EntryConfirmationUnitOfWork) => Promise<T>): Promise<T>;
}

const confirmationEntryInclude = {
  supplier: { select: { id: true, status: true } },
  items: {
    include: { product: { select: { id: true, name: true, unit: true, stockMode: true, status: true, cost: true } } },
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};

const responseEntryInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, unit: true, stockMode: true } } }, orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
};

export class PrismaEntryConfirmationRepository implements EntryConfirmationRepository {
  constructor(private readonly auditService: AuditService) {}

  transaction<T>(operation: (unitOfWork: EntryConfirmationUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (transaction) => operation({
      lockEntry: async (id) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "entries" WHERE "id" = ${id}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.entry.findUnique({ where: { id }, include: confirmationEntryInclude });
      },
      lockSupplier: async (id) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "suppliers" WHERE "id" = ${id}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.supplier.findUnique({ where: { id }, select: { status: true } });
      },
      lockProducts: async (ids) => {
        for (const id of [...ids].sort()) {
          await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${id}::uuid FOR UPDATE`;
        }
        return transaction.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, unit: true, stockMode: true, status: true, cost: true }, orderBy: { id: 'asc' } });
      },
      increaseSimpleBalance: (productId, quantity) => transaction.stockBalance.upsert({ where: { productId }, create: { productId, quantity }, update: { quantity: { increment: quantity } } }),
      findLot: (data) => transaction.stockLot.findFirst({ where: { productId: data.productId, identifier: data.identifier, expirationDate: data.expirationDate } }),
      createLot: (data) => transaction.stockLot.create({ data: { productId: data.productId, identifier: data.identifier, expirationDate: data.expirationDate, unitCost: data.unitCost, initialQuantity: data.quantity, currentQuantity: data.quantity } }),
      addToLot: (lotId, quantity, unitCost) => transaction.stockLot.update({ where: { id: lotId }, data: { initialQuantity: { increment: quantity }, currentQuantity: { increment: quantity }, unitCost } }),
      createMovement: (data) => transaction.stockMovement.create({ data: { productId: data.productId, lotId: data.lotId, type: 'ENTRY', quantity: data.quantity, actorUserId: data.actorUserId, reason: data.reason } }),
      updateSimpleProductCost: async (productId, previous, next, actorUserId, entryId) => {
        if (previous.equals(next)) return;
        await transaction.product.update({ where: { id: productId }, data: { cost: next } });
        await transaction.productValueHistory.create({ data: { productId, field: 'COST', previousValue: previous, newValue: next, source: 'ENTRY', sourceId: entryId, changedByUserId: actorUserId } });
      },
      markConfirmed: async (entryId) => {
        const changed = await transaction.entry.updateMany({ where: { id: entryId, status: 'EM_ANDAMENTO' }, data: { status: 'CONFIRMADA' } });
        return changed.count === 1;
      },
      findEntry: (id) => transaction.entry.findUniqueOrThrow({ where: { id }, include: responseEntryInclude }),
      audit: ({ actorUserId, entryId, ipAddress, before, after }) => this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'ENTRY_CONFIRMED', before, after, entity: 'Entry', entityId: entryId, ipAddress }, transaction),
    }));
  }
}
