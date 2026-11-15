import { describe, expect, it, jest } from '@jest/globals';
import type { Category, Product } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import { ProductUpdateService } from './product.update.service.js';

const currentProduct = { id: 'product-id', categoryId: 'category-id', name: 'Produto', sku: 'PRD-1', stockMode: 'SIMPLES' } as Product;
const category = { id: 'other-category' } as Category;
const input = { name: ' Produto atualizado ', description: '', barcode: '', categoryId: 'category-id', unit: 'UN' as const, cost: 3, salePrice: 5, minimumStock: 0, stockMode: 'SIMPLES' as const, expirationAlertDays: 15 };

describe('ProductUpdateService', () => {
  it('updates editable values and clears optional text fields', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(async () => currentProduct), create: jest.fn(), list: jest.fn(), update: jest.fn(async () => currentProduct), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await new ProductUpdateService(repository).update(currentProduct.id, input, 'user-id');
    expect(repository.update).toHaveBeenCalledWith(currentProduct.id, expect.objectContaining({ name: 'Produto atualizado', description: null, barcode: null, actorUserId: 'user-id' }));
  });

  it('requires an active category when changing category', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(async () => null), findById: jest.fn(async () => currentProduct), create: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await expect(new ProductUpdateService(repository).update(currentProduct.id, { ...input, categoryId: category.id }, 'user-id')).rejects.toMatchObject({ code: 'CATEGORY_INACTIVE_OR_NOT_FOUND', statusCode: 400 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('returns a not-found error for unknown products', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(async () => null), create: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await expect(new ProductUpdateService(repository).get('missing')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('blocks changing stock mode when the repository detects movements', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(async () => currentProduct), create: jest.fn(), list: jest.fn(), update: jest.fn(async () => { throw new Error('PRODUCT_STOCK_MODE_IMMUTABLE'); }), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await expect(new ProductUpdateService(repository).update(currentProduct.id, { ...input, stockMode: 'LOTE' }, 'user-id')).rejects.toMatchObject({ code: 'PRODUCT_STOCK_MODE_IMMUTABLE', statusCode: 409 });
  });
});
