import { Prisma, type StockBalance, type StockLot, type StockMovement } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EntryWithItems } from './entry.repository.js';

export type CancellationEntry = Prisma.EntryGetPayload<{
  include: {
    items: { include: { product: { select: { id: true; name: true; stockMode: true } } }; orderBy: [{ position: 'asc' }, { id: 'asc' }] };
  };
}>;

export interface EntryCancellationUnitOfWork {
  lockEntry(id: string): Promise<CancellationEntry | null>;
  lockProducts(ids: string[]): Promise<void>;
  getSimpleBalance(productId: string): Promise<StockBalance | null>;
  changeSimpleBalance(productId: string, quantity: Prisma.Decimal): Promise<StockBalance>;
  getLot(productId: string, identifier: string, expirationDate: Date | null): Promise<StockLot | null>;
  changeLot(lotId: string, quantity: Prisma.Decimal): Promise<StockLot>;
  getEntryMovements(entryId: string): Promise<StockMovement[]>;
  getLotMovements(lotId: string): Promise<StockMovement[]>;
  createReversal(data: { productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; actorUserId: string }): Promise<StockMovement>;
  markCanceled(entryId: string): Promise<boolean>;
  findEntry(id: string): Promise<EntryWithItems>;
  audit(event: { actorUserId: string; entryId: string; ipAddress?: string; justification: string; reversals: Array<{ productId: string; lotId: string | null; quantity: string }> }): Promise<void>;
}

export interface EntryCancellationRepository {
  transaction<T>(operation: (unitOfWork: EntryCancellationUnitOfWork) => Promise<T>): Promise<T>;
}

const cancellationEntryInclude = {
  items: {
    include: { product: { select: { id: true, name: true, stockMode: true } } },
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};
const responseEntryInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, unit: true, stockMode: true } } }, orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
};

export class PrismaEntryCancellationRepository implements EntryCancellationRepository {
  constructor(private readonly auditService: AuditService) {}

  transaction<T>(operation: (unitOfWork: EntryCancellationUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (transaction) => operation({
      lockEntry: async (id) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "entries" WHERE "id" = ${id}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.entry.findUnique({ where: { id }, include: cancellationEntryInclude });
      },
      lockProducts: async (ids) => {
        for (const id of [...ids].sort()) await transaction.$queryRaw`SELECT "id" FROM "products" WHERE "id" = ${id}::uuid FOR UPDATE`;
      },
      getSimpleBalance: async (productId) => {
        await transaction.$queryRaw`SELECT "id" FROM "stock_balances" WHERE "product_id" = ${productId}::uuid FOR UPDATE`;
        return transaction.stockBalance.findUnique({ where: { productId } });
      },
      changeSimpleBalance: async (productId, quantity) => {
        await transaction.stockBalance.updateMany({ where: { productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        return transaction.stockBalance.findUniqueOrThrow({ where: { productId } });
      },
      getLot: async (productId, identifier, expirationDate) => {
        const lot = await transaction.stockLot.findFirst({ where: { productId, identifier, expirationDate } });
        if (!lot) return null;
        await transaction.$queryRaw`SELECT "id" FROM "stock_lots" WHERE "id" = ${lot.id}::uuid FOR UPDATE`;
        return transaction.stockLot.findUnique({ where: { id: lot.id } });
      },
      changeLot: (lotId, quantity) => transaction.stockLot.update({ where: { id: lotId }, data: { initialQuantity: { decrement: quantity }, currentQuantity: { decrement: quantity } } }),
      getEntryMovements: (entryId) => transaction.stockMovement.findMany({ where: { reason: `Confirmação da entrada ${entryId}`, type: 'ENTRY' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      getLotMovements: (lotId) => transaction.stockMovement.findMany({ where: { lotId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      createReversal: (data) => transaction.stockMovement.create({ data: { productId: data.productId, lotId: data.lotId, type: 'REVERSAL_OUT', quantity: data.quantity, reason: data.reason, actorUserId: data.actorUserId } }),
      markCanceled: async (entryId) => {
        const result = await transaction.entry.updateMany({ where: { id: entryId, status: 'CONFIRMADA' }, data: { status: 'CANCELADA' } });
        return result.count === 1;
      },
      findEntry: (id) => transaction.entry.findUniqueOrThrow({ where: { id }, include: responseEntryInclude }),
      audit: ({ actorUserId, entryId, ipAddress, justification, reversals }) => this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'ENTRY_CANCELED', before: { status: 'CONFIRMADA' }, after: { status: 'CANCELADA', justification, reversals }, entity: 'Entry', entityId: entryId, ipAddress }, transaction),
    }));
  }
}
