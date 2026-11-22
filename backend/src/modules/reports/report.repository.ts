import { prisma } from '../../infrastructure/database/prisma.js';
import type { MovementReportQuery, ReportPeriod } from './report.schemas.js';

function periodWhere(period: ReportPeriod): { gte?: Date; lte?: Date } {
  const where: { gte?: Date; lte?: Date } = {};
  if (period.from) where.gte = new Date(`${period.from}T00:00:00.000Z`);
  if (period.to) where.lte = new Date(`${period.to}T23:59:59.999Z`);
  return where;
}

export class PrismaReportRepository {
  listProducts() {
    return prisma.product.findMany({
      include: { stockBalance: true, stockLots: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  listMovements(query: MovementReportQuery) {
    const where = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to ? { createdAt: periodWhere(query) } : {}),
    };
    return prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          lot: { select: { identifier: true } },
          actorUser: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);
  }

  listLots() {
    return prisma.stockLot.findMany({
      include: { product: { select: { name: true, sku: true, expirationAlertDays: true, unit: true } } },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
    });
  }

  listEntries(period: ReportPeriod) {
    return prisma.entry.findMany({
      where: { status: 'CONFIRMADA', ...(period.from || period.to ? { createdAt: periodWhere(period) } : {}) },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  listProductsWithSales(period: ReportPeriod) {
    return prisma.product.findMany({
      include: {
        saleItems: {
          include: { sale: { select: { status: true, confirmedAt: true } } },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
