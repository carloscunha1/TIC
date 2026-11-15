import { Prisma, type Product, type StockLot } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import type { StockBalanceProduct, StockBalanceRepository } from './stock-balance.repository.js';
import { StockBalanceService } from './stock-balance.service.js';

function product(mode: 'SIMPLES' | 'LOTE', lots: Array<{ id: string; expirationDate: Date | null; currentQuantity: string }>, balance = '0') {
  const stockLots = lots.map((lot, index) => ({
    id: lot.id,
    productId: 'product-1',
    identifier: lot.id,
    expirationDate: lot.expirationDate,
    unitCost: new Prisma.Decimal('1.00'),
    initialQuantity: new Prisma.Decimal(lot.currentQuantity),
    currentQuantity: new Prisma.Decimal(lot.currentQuantity),
    receivedAt: new Date(Date.UTC(2025, 0, index + 1)),
    createdAt: new Date(Date.UTC(2025, 0, index + 1)),
    updatedAt: new Date(Date.UTC(2025, 0, index + 1)),
  })) as StockLot[];
  return {
    id: 'product-1', sku: 'SKU-1', name: 'Produto', description: null, barcode: null, categoryId: 'category-1', unit: 'UN', cost: new Prisma.Decimal('1.00'), salePrice: new Prisma.Decimal('2.00'), minimumStock: new Prisma.Decimal(0), stockMode: mode, expirationAlertDays: 15, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
    stockBalance: mode === 'SIMPLES' ? { quantity: new Prisma.Decimal(balance) } : null,
    stockLots,
  } as unknown as StockBalanceProduct;
}

class FakeBalanceRepository implements StockBalanceRepository {
  constructor(private readonly products: StockBalanceProduct[]) {}
  async list() { return { products: this.products, total: this.products.length }; }
}

describe('StockBalanceService.list', () => {
  it('reports physical lots including expired stock and available balance excluding it', async () => {
    const repository = new FakeBalanceRepository([product('LOTE', [
      { id: 'expired', expirationDate: new Date('2025-04-29T00:00:00.000Z'), currentQuantity: '3' },
      { id: 'expires-today', expirationDate: new Date('2025-04-30T00:00:00.000Z'), currentQuantity: '4' },
      { id: 'no-expiration', expirationDate: null, currentQuantity: '2' },
    ])]);
    const result = await new StockBalanceService(repository, () => new Date('2025-04-30T22:30:00.000Z')).list(1, 20);
    expect(result.products[0]).toMatchObject({ physicalBalance: '9', availableBalance: '6' });
    expect(result.products[0]?.lots.map((lot) => lot.available)).toEqual([false, true, true]);
  });

  it('excludes lots on the previous local date at midnight in Sao Paulo', async () => {
    const repository = new FakeBalanceRepository([product('LOTE', [
      { id: 'expired-at-midnight', expirationDate: new Date('2025-04-30T00:00:00.000Z'), currentQuantity: '2' },
    ])]);
    const result = await new StockBalanceService(repository, () => new Date('2025-05-01T03:00:00.000Z')).list(1, 20);
    expect(result.products[0]).toMatchObject({ physicalBalance: '2', availableBalance: '0' });
    expect(result.products[0]?.lots[0]?.available).toBe(false);
  });

  it('uses the aggregate balance for simple products', async () => {
    const repository = new FakeBalanceRepository([product('SIMPLES', [], '7.5')]);
    const result = await new StockBalanceService(repository).list(1, 20);
    expect(result.products[0]).toMatchObject({ physicalBalance: '7.5', availableBalance: '7.5', lots: [] });
  });
});
