import { describe, expect, it, jest } from '@jest/globals';
import type { Category } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';
import { CategoryService } from './category.service.js';

const category: Category = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Bebidas',
  description: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CategoryService.create', () => {
  it('normalizes and persists a category', async () => {
    const repo: CategoryRepository = { create: jest.fn(async () => category), findById: jest.fn(), list: jest.fn(), update: jest.fn() };
    await new CategoryService(repo).create({ name: ' Bebidas ', description: '  Frias  ' }, 'user-id', '127.0.0.1');
    expect(repo.create).toHaveBeenCalledWith({ actorUserId: 'user-id', description: 'Frias', ipAddress: '127.0.0.1', name: 'Bebidas' });
  });
});
