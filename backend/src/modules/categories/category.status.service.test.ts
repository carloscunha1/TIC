import { describe, expect, it, jest } from '@jest/globals';
import type { Category } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';
import { CategoryStatusService } from './category.status.service.js';

const category: Category = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Bebidas', description: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('CategoryStatusService.update', () => {
  it('changes the category status', async () => {
    const repo: CategoryRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(async () => ({ ...category, status: 'INACTIVE' })) };
    await expect(new CategoryStatusService(repo).update(category.id, 'INACTIVE', 'user-id')).resolves.toMatchObject({ status: 'INACTIVE' });
  });

  it('rejects a missing category', async () => {
    const repo: CategoryRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(async () => { throw new Error('CATEGORY_NOT_FOUND'); }) };
    await expect(new CategoryStatusService(repo).update(category.id, 'INACTIVE', 'user-id')).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND', statusCode: 404 });
  });
});
