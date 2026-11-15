import { Prisma } from '@prisma/client';
import type { StockBalanceProduct, StockBalanceRepository } from './stock-balance.repository.js';

function saoPauloToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function isAvailable(lot: StockBalanceProduct['stockLots'][number], today: Date): boolean {
  return lot.currentQuantity.greaterThan(0) && (!lot.expirationDate || lot.expirationDate.getTime() >= today.getTime());
}

export class StockBalanceService {
  constructor(private readonly repository: StockBalanceRepository, private readonly clock: () => Date = () => new Date()) {}

  async list(page: number, pageSize: number) {
    const result = await this.repository.list(page, pageSize);
    const today = saoPauloToday(this.clock());
    return {
      ...result,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
      products: result.products.map((product) => this.serializeProduct(product, today)),
    };
  }

  private serializeProduct(product: StockBalanceProduct, today: Date) {
    const physicalBalance = product.stockMode === 'SIMPLES'
      ? product.stockBalance?.quantity ?? new Prisma.Decimal(0)
      : product.stockLots.reduce((sum, lot) => sum.plus(lot.currentQuantity), new Prisma.Decimal(0));
    const availableBalance = product.stockMode === 'SIMPLES'
      ? physicalBalance
      : product.stockLots.filter((lot) => isAvailable(lot, today)).reduce((sum, lot) => sum.plus(lot.currentQuantity), new Prisma.Decimal(0));

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      stockMode: product.stockMode,
      status: product.status,
      physicalBalance: physicalBalance.toString(),
      availableBalance: availableBalance.toString(),
      lots: product.stockMode === 'LOTE' ? product.stockLots.map((lot) => ({
        id: lot.id,
        identifier: lot.identifier,
        expirationDate: lot.expirationDate?.toISOString().slice(0, 10) ?? null,
        unitCost: lot.unitCost.toString(),
        initialQuantity: lot.initialQuantity.toString(),
        currentQuantity: lot.currentQuantity.toString(),
        receivedAt: lot.receivedAt.toISOString(),
        available: isAvailable(lot, today),
      })) : [],
    };
  }
}
