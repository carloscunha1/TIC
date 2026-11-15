import { Prisma, type Product, type StockBalance, type StockMovement } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type StockAdjustmentProduct = Pick<Product, 'id' | 'name' | 'unit' | 'stockMode' | 'status'>;
export type StockAdjustmentMovementData = { productId: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; quantity: Prisma.Decimal; justification: string; actorUserId: string };

export interface StockAdjustmentUnitOfWork {
  lockProduct(productId: string): Promise<StockAdjustmentProduct | null>;
  getBalance(productId: string): Promise<StockBalance | null>;
  changeBalance(productId: string, direction: 'POSITIVE' | 'NEGATIVE', quantity: Prisma.Decimal): Promise<StockBalance>;
  createMovement(data: StockAdjustmentMovementData): Promise<StockMovement>;
  audit(data: { actorUserId: string; ipAddress?: string; productId: string; productName: string; previousBalance: string; nextBalance: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'; quantity: string; justification: string; movementId: string }): Promise<void>;
}

export interface StockAdjustmentRepository {
  transaction<T>(operation: (unitOfWork: StockAdjustmentUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaStockAdjustmentRepository implements StockAdjustmentRepository {
  constructor(private readonly auditService: AuditService) {}

  transaction<T>(operation: (unitOfWork: StockAdjustmentUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (transaction) => operation({
      lockProduct: async (productId) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.product.findUnique({ where: { id: productId }, select: { id: true, name: true, unit: true, stockMode: true, status: true } });
      },
      getBalance: async (productId) => {
        await transaction.$queryRaw`SELECT "id" FROM "stock_balances" WHERE "product_id" = ${productId}::uuid FOR UPDATE`;
        return transaction.stockBalance.findUnique({ where: { productId } });
      },
      changeBalance: async (productId, direction, quantity) => {
        if (direction === 'POSITIVE') {
          return transaction.stockBalance.upsert({ where: { productId }, create: { productId, quantity }, update: { quantity: { increment: quantity } } });
        }
        const result = await transaction.stockBalance.updateMany({ where: { productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        if (result.count !== 1) throw new Error('INSUFFICIENT_STOCK');
        return transaction.stockBalance.findUniqueOrThrow({ where: { productId } });
      },
      createMovement: (data) => transaction.stockMovement.create({ data: { productId: data.productId, type: data.type, quantity: data.quantity, reason: data.justification, actorUserId: data.actorUserId, createdAt: new Date() } }),
      audit: ({ actorUserId, ipAddress, productId, productName, previousBalance, nextBalance, type, quantity, justification, movementId }) => this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'STOCK_ADJUSTMENT_RECORDED', before: { productId, productName, balance: previousBalance }, after: { productId, productName, balance: nextBalance, movementId, type, quantity, justification }, entity: 'StockMovement', entityId: movementId, ipAddress }, transaction),
    }));
  }
}
