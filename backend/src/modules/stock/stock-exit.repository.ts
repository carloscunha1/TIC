import { Prisma, type Product, type StockLot, type StockMovement } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type StockExitProduct = Pick<Product, 'id' | 'name' | 'unit' | 'stockMode' | 'status'>;
export type StockExitMovementData = { productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; actorUserId: string };

export interface StockExitUnitOfWork {
  lockProduct(productId: string): Promise<StockExitProduct | null>;
  getSimpleBalance(productId: string): Promise<Prisma.Decimal | null>;
  changeSimpleBalance(productId: string, quantity: Prisma.Decimal): Promise<Prisma.Decimal>;
  getLots(productId: string): Promise<StockLot[]>;
  changeLot(lotId: string, quantity: Prisma.Decimal): Promise<void>;
  createMovement(data: StockExitMovementData): Promise<StockMovement>;
  audit(data: { actorUserId: string; ipAddress?: string; productId: string; productName: string; reason: string; quantity: string; physicalBefore: string; physicalAfter: string; availableBefore: string; availableAfter: string; movements: Array<{ id: string; lotId: string | null; lotIdentifier: string | null; quantity: string }> }): Promise<void>;
}

export interface StockExitRepository {
  transaction<T>(operation: (unitOfWork: StockExitUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaStockExitRepository implements StockExitRepository {
  constructor(private readonly auditService: AuditService) {}

  transaction<T>(operation: (unitOfWork: StockExitUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (transaction) => operation({
      lockProduct: async (productId) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.product.findUnique({ where: { id: productId }, select: { id: true, name: true, unit: true, stockMode: true, status: true } });
      },
      getSimpleBalance: async (productId) => {
        await transaction.$queryRaw`SELECT "id" FROM "stock_balances" WHERE "product_id" = ${productId}::uuid FOR UPDATE`;
        return (await transaction.stockBalance.findUnique({ where: { productId }, select: { quantity: true } }))?.quantity ?? null;
      },
      changeSimpleBalance: async (productId, quantity) => {
        const result = await transaction.stockBalance.updateMany({ where: { productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        if (result.count !== 1) throw new Error('INSUFFICIENT_STOCK');
        return (await transaction.stockBalance.findUniqueOrThrow({ where: { productId }, select: { quantity: true } })).quantity;
      },
      getLots: (productId) => transaction.stockLot.findMany({ where: { productId, currentQuantity: { gt: 0 } }, orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }, { id: 'asc' }] }),
      changeLot: async (lotId, quantity) => {
        const result = await transaction.stockLot.updateMany({ where: { id: lotId, currentQuantity: { gte: quantity } }, data: { currentQuantity: { decrement: quantity } } });
        if (result.count !== 1) throw new Error('INSUFFICIENT_STOCK');
      },
      createMovement: (data) => transaction.stockMovement.create({ data: { productId: data.productId, lotId: data.lotId, type: 'EXIT', quantity: data.quantity, reason: data.reason, actorUserId: data.actorUserId, createdAt: new Date() } }),
      audit: ({ actorUserId, ipAddress, productId, productName, reason, quantity, physicalBefore, physicalAfter, availableBefore, availableAfter, movements }) => this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'STOCK_EXIT_RECORDED', before: { productId, productName, physicalBalance: physicalBefore, availableBalance: availableBefore }, after: { productId, productName, reason, quantity, physicalBalance: physicalAfter, availableBalance: availableAfter, movements }, entity: 'Product', entityId: productId, ipAddress }, transaction),
    }));
  }
}
