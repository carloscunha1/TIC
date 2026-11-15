import { Prisma, type Product, type StockLot } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export type StockBalanceProduct = Product & { stockBalance: { quantity: Prisma.Decimal } | null; stockLots: StockLot[] };

export interface StockBalanceRepository {
  list(page: number, pageSize: number): Promise<{ products: StockBalanceProduct[]; total: number }>;
}

export class PrismaStockBalanceRepository implements StockBalanceRepository {
  async list(page: number, pageSize: number): Promise<{ products: StockBalanceProduct[]; total: number }> {
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        include: {
          stockBalance: { select: { quantity: true } },
          stockLots: { orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }, { id: 'asc' }] },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count(),
    ]);
    return { products, total };
  }
}
