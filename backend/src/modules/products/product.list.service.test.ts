import { describe, expect, it, jest } from '@jest/globals';
import type { Product } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import { ProductListService } from './product.list.service.js';

const product = { id: 'product-id', sku: 'PRD-example', name: 'Refrigerante', description: null, barcode: null, categoryId: 'category-id', unit: 'UN', cost: { toString: () => '2.00' }, salePrice: { toString: () => '4.00' }, minimumStock: { toString: () => '0.000' }, stockMode: 'SIMPLES', expirationAlertDays: 15, status: 'ACTIVE' } as unknown as Product;

describe('ProductListService.list', () => {
  it('applies filters, returns pagination and serializes decimal values', async () => {
    const repo: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(), create: jest.fn(), list: jest.fn(async () => ({ products: [product], total: 21 })), update: jest.fn(), listValueHistory: jest.fn() };
    const result = await new ProductListService(repo).list({ page: 2, pageSize: 20, search: 'refrigerante', categoryId: 'category-id', status: 'ACTIVE', stockMode: 'SIMPLES' });
    expect(result).toMatchObject({ page: 2, total: 21, totalPages: 2, products: [{ sku: 'PRD-example', salePrice: '4.00' }] });
    expect(result.products[0]).not.toHaveProperty('cost');
    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 20, search: 'refrigerante', categoryId: 'category-id', status: 'ACTIVE', stockMode: 'SIMPLES' });
  });
});
