import { describe, expect, it, jest } from '@jest/globals';
import type { Category, Product } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import { ProductService } from './product.service.js';

const category: Category = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Bebidas', description: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };
const product = {} as Product;

describe('ProductService.create', () => {
  it('requires an active category and delegates valid product data', async () => {
    const repo: ProductRepository = { findActiveCategory: jest.fn(async () => category), findById: jest.fn(), create: jest.fn(async () => product), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await new ProductService(repo).create({ name: ' Refrigerante ', categoryId: category.id, unit: 'UN', cost: 2, salePrice: 4, minimumStock: 0, stockMode: 'SIMPLES', expirationAlertDays: 15 }, 'user-id');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Refrigerante', categoryId: category.id, unit: 'UN' }));
  });

  it('rejects an inactive or missing category', async () => {
    const repo: ProductRepository = { findActiveCategory: jest.fn(async () => null), findById: jest.fn(), create: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(), listValueHistory: jest.fn() };
    await expect(new ProductService(repo).create({ name: 'Produto', categoryId: category.id, unit: 'KG', cost: 1, salePrice: 2, minimumStock: 0, stockMode: 'LOTE', expirationAlertDays: 15 }, 'user-id')).rejects.toMatchObject({ code: 'CATEGORY_INACTIVE_OR_NOT_FOUND', statusCode: 400 });
  });
});
