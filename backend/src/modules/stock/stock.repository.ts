import { Prisma, type Product, type StockBalance, type StockMovement, type StockMovementType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export type LockedStockProduct = Pick<Product, 'id' | 'unit' | 'stockMode' | 'status'>;
export type StockMovementWrite = { productId: string; type: StockMovementType; quantity: Prisma.Decimal; reason: string; observations?: string; actorUserId: string };
export type StockMovementDirection = 'IN' | 'OUT';

export interface StockMovementUnitOfWork {
  lockProduct(productId: string): Promise<LockedStockProduct | null>;
  changeBalance(productId: string, direction: StockMovementDirection, quantity: Prisma.Decimal): Promise<StockBalance>;
  createMovement(data: StockMovementWrite): Promise<StockMovement>;
}

export interface StockMovementRepository {
  transaction<T>(operation: (unitOfWork: StockMovementUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaStockMovementRepository implements StockMovementRepository {
  transaction<T>(operation: (unitOfWork: StockMovementUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (transaction) => operation({
      lockProduct: async (productId) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`;
        if (rows.length === 0) return null;
        return transaction.product.findUnique({ where: { id: productId }, select: { id: true, unit: true, stockMode: true, status: true } });
      },
      changeBalance: async (productId, direction, quantity) => {
        if (direction === 'IN') {
          return transaction.stockBalance.upsert({ where: { productId }, create: { productId, quantity }, update: { quantity: { increment: quantity } } });
        }
        const result = await transaction.stockBalance.updateMany({ where: { productId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
        if (result.count === 0) throw new Error('INSUFFICIENT_STOCK');
        const balance = await transaction.stockBalance.findUnique({ where: { productId } });
        if (!balance) throw new Error('STOCK_BALANCE_NOT_FOUND');
        return balance;
      },
      createMovement: (data) => transaction.stockMovement.create({ data: { ...data, createdAt: new Date() } }),
    }));
  }
}
