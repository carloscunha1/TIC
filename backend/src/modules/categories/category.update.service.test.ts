import { describe, expect, it, jest } from '@jest/globals';
import type { Category } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';
import { CategoryUpdateService } from './category.update.service.js';

const category: Category = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Bebidas', description: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('CategoryUpdateService.update', () => {
  it('updates the allowed fields', async () => {
    const repo: CategoryRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(async () => ({ ...category, name: 'Mercearia', description: 'Geral' })) };
    const result = await new CategoryUpdateService(repo).update(category.id, { name: ' Mercearia ', description: ' Geral ' }, 'user-id');
    expect(result).toMatchObject({ name: 'Mercearia', description: 'Geral' });
    expect(repo.update).toHaveBeenCalledWith(category.id, { actorUserId: 'user-id', description: 'Geral', ipAddress: undefined, name: 'Mercearia' });
  });

  it('rejects a missing category', async () => {
    const repo: CategoryRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(async () => { throw new Error('CATEGORY_NOT_FOUND'); }) };
    await expect(new CategoryUpdateService(repo).update(category.id, { name: 'A', description: '' }, 'user-id')).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND', statusCode: 404 });
  });
});
