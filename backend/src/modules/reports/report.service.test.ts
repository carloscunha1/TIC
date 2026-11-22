import { describe, expect, it, jest } from '@jest/globals';
import { ReportService, toCsv } from './report.service.js';
import type { PrismaReportRepository } from './report.repository.js';

function repository(overrides: Partial<Record<keyof PrismaReportRepository, unknown>> = {}): PrismaReportRepository {
  return {
    listProducts: jest.fn(async () => []),
    listMovements: jest.fn(async () => [[], 0]),
    listLots: jest.fn(async () => []),
    listEntries: jest.fn(async () => []),
    listProductsWithSales: jest.fn(async () => []),
    listSales: jest.fn(async () => [[], 0]),
    listLoyaltyMovements: jest.fn(async () => []),
    listCustomersForLoyalty: jest.fn(async () => []),
    listDashboardSales: jest.fn(async () => []),
    listDashboardMovements: jest.fn(async () => []),
    ...overrides,
  } as unknown as PrismaReportRepository;
}

describe('ReportService', () => {
  it('calculates physical, available and estimated stock value', async () => {
    const service = new ReportService(repository({
      listProducts: jest.fn(async () => [{
        id: 'product-id',
        sku: 'SKU-1',
        name: 'Café',
        unit: 'UN',
        stockMode: 'SIMPLES',
        cost: { toString: () => '8.50' },
        minimumStock: { toString: () => '2' },
        stockBalance: { quantity: { toString: () => '3' } },
        stockLots: [],
      }]),
    }));

    await expect(service.stockPosition()).resolves.toEqual([expect.objectContaining({
      physical: 3,
      available: 3,
      estimatedValue: 25.5,
      belowMinimum: false,
      zero: false,
    })]);
  });

  it('consolidates confirmed entries by supplier and product', async () => {
    const service = new ReportService(repository({
      listEntries: jest.fn(async () => [{
        supplier: { name: 'Fornecedor A' },
        items: [{
          quantity: { toString: () => '4' },
          unitCost: { toString: () => '2.50' },
          product: { id: 'product-id', name: 'Água', sku: 'SKU-2' },
        }],
      }]),
    }));

    await expect(service.supplierEntries({ from: '2026-01-01', to: '2026-01-31', format: 'json' })).resolves.toMatchObject({
      suppliers: [{ supplier: 'Fornecedor A', entries: 1, quantity: 4, totalCost: 10 }],
      products: [{ product: 'Água', sku: 'SKU-2', quantity: 4, totalCost: 10, entries: 1 }],
    });
  });

  it('escapes CSV headers and values', () => {
    expect(toCsv(['Produto', 'Observação'], [['Café', 'A "especial"']])).toBe('"Produto","Observação"\r\n"Café","A ""especial"""');
  });

  it('excludes cancelled sales and deducts confirmed partial returns from liquid value', async () => {
    const confirmedAt = new Date('2026-11-20T12:00:00.000Z');
    const sales = [
      {
        id: 'sale-1',
        status: 'CONFIRMADA',
        total: { toString: () => '100.00' },
        paymentMethod: 'PIX',
        confirmedAt,
        customer: { name: 'Cliente A' },
        operator: { name: 'Operador A' },
        items: [{
          productId: 'product-1',
          quantity: { toString: () => '10' },
          unitPrice: { toString: () => '10.00' },
          product: { sku: 'SKU-1', name: 'Produto A' },
          returns: [{ quantity: { toString: () => '2' }, returnRecord: { status: 'CONFIRMADA' } }],
        }],
      },
      {
        id: 'sale-2',
        status: 'CANCELADA',
        total: { toString: () => '50.00' },
        paymentMethod: 'CASH',
        confirmedAt,
        customer: null,
        operator: { name: 'Operador A' },
        items: [],
      },
    ];
    const service = new ReportService(repository({
      listSales: jest.fn(async () => [sales, 2]),
    }));

    await expect(service.sales({ from: '2026-11-01', to: '2026-11-30', format: 'json', page: 1, pageSize: 20 })).resolves.toMatchObject({
      totals: { gross: 100, liquid: 80, averageTicket: 80 },
      products: [{ sku: 'SKU-1', product: 'Produto A', quantity: 8, liquidValue: 80 }],
    });
  });

  it('ranks loyalty credits and calculates balance totals for the period', async () => {
    const date = new Date('2026-11-20T12:00:00.000Z');
    const movements = [
      { id: 'move-1', customerId: 'customer-1', type: 'CREDIT', pointsDelta: 30, reason: null, createdAt: date, customer: { id: 'customer-1', name: 'Cliente A', status: 'ACTIVE' } },
      { id: 'move-2', customerId: 'customer-1', type: 'REDEMPTION', pointsDelta: -10, reason: null, createdAt: date, customer: { id: 'customer-1', name: 'Cliente A', status: 'ACTIVE' } },
    ];
    const customers = [
      { id: 'customer-1', name: 'Cliente A', status: 'ACTIVE', loyaltyMovements: [{ pointsDelta: 20 }] },
      { id: 'customer-2', name: 'Cliente B', status: 'ACTIVE', loyaltyMovements: [{ pointsDelta: -5 }] },
    ];
    const service = new ReportService(repository({
      listLoyaltyMovements: jest.fn(async () => movements),
      listCustomersForLoyalty: jest.fn(async () => customers),
    }));

    await expect(service.loyalty({ from: '2026-11-01', to: '2026-11-30', format: 'json' })).resolves.toMatchObject({
      totals: { granted: 30, redeemed: 10, expired: 0, balanceInCirculation: 20 },
      ranking: [{ customerId: 'customer-1', customer: 'Cliente A', points: 30 }],
      negativeBalances: [{ customerId: 'customer-2', customer: 'Cliente B', balance: -5 }],
    });
  });

  it('keeps current stock independent of the dashboard period', async () => {
    const service = new ReportService(repository({
      listProducts: jest.fn(async () => [{
        id: 'product-1',
        sku: 'SKU-1',
        name: 'Produto A',
        unit: 'UN',
        stockMode: 'SIMPLES',
        cost: { toString: () => '12.50' },
        minimumStock: { toString: () => '5' },
        stockBalance: { quantity: { toString: () => '8' } },
        stockLots: [],
      }]),
      listLots: jest.fn(async () => []),
      listEntries: jest.fn(async () => []),
      listLoyaltyMovements: jest.fn(async () => []),
      listCustomersForLoyalty: jest.fn(async () => []),
      listDashboardSales: jest.fn(async () => []),
      listDashboardMovements: jest.fn(async () => []),
    }));

    const first = await service.dashboard({ from: '2026-11-01', to: '2026-11-30' });
    const second = await service.dashboard({ from: '2026-10-01', to: '2026-10-31' });

    expect(first.stock).toEqual(second.stock);
    expect(first.stock).toMatchObject({
      productCount: 1,
      physicalQuantity: 8,
      availableQuantity: 8,
      estimatedValue: 100,
      belowMinimum: 0,
    });
  });
});
