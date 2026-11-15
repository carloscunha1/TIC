import { describe, expect, it, jest } from '@jest/globals';
import type { User } from '@prisma/client';
import type { UserUpdateRepository } from '../auth/user.repository.js';
import { UserUpdateService } from './user.update.service.js';

const user: User = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Administrador',
  email: 'admin@example.com',
  passwordHash: 'never-returned',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repository(): UserUpdateRepository {
  return {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(async () => user),
    list: jest.fn(),
    update: jest.fn(async (_id, input) => ({ ...user, ...input })),
    updateStatus: jest.fn(),
  };
}

describe('UserUpdateService', () => {
  it('updates name and role without changing email or id', async () => {
    const repo = repository();
    const result = await new UserUpdateService(repo).update(user.id, { name: 'Novo Nome', role: 'OPERATOR' });
    expect(result).toMatchObject({ id: user.id, email: user.email, name: 'Novo Nome', role: 'OPERATOR' });
    expect(repo.update).toHaveBeenCalledWith(user.id, { name: 'Novo Nome', role: 'OPERATOR' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns not found when the user does not exist', async () => {
    const repo = repository();
    repo.findById = jest.fn(async () => null);
    await expect(new UserUpdateService(repo).findById(user.id)).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });
});
