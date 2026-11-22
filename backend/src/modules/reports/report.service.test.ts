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
});
