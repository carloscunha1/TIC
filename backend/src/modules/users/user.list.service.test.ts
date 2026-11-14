import { describe, expect, it, jest } from '@jest/globals';
import type { User } from '@prisma/client';
import type { UserQueryRepository } from '../auth/user.repository.js';
import { UserListService } from './user.list.service.js';

const users: User[] = [{
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Administrador',
  email: 'admin@example.com',
  passwordHash: 'never-returned',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
}];

function repository(): UserQueryRepository {
  return { findByEmail: jest.fn(), findById: jest.fn(), list: jest.fn(async () => ({ total: users.length, users })) };
}

describe('UserListService.list', () => {
  it('returns pagination and public user fields only', async () => {
    const result = await new UserListService(repository()).list({ page: 1, pageSize: 20 });
    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(result.users[0]).not.toHaveProperty('passwordHash');
    expect(result.users[0]).toMatchObject({ email: 'admin@example.com', role: 'ADMIN' });
  });
});
