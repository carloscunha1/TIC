import { describe, expect, it, jest } from '@jest/globals';
import type { Category } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';
import { CategoryListService } from './category.list.service.js';

const category: Category = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Bebidas', description: 'Frias', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('CategoryListService.list', () => {
  it('returns filtered pagination data', async () => {
    const repo: CategoryRepository = { create: jest.fn(), list: jest.fn(async () => ({ categories: [category], total: 21 })) };
    const result = await new CategoryListService(repo).list({ page: 2, pageSize: 20, name: 'beb', status: 'ACTIVE' });
    expect(result).toMatchObject({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(result.categories[0]).toMatchObject({ name: 'Bebidas', status: 'ACTIVE' });
    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 20, name: 'beb', status: 'ACTIVE' });
  });
});
