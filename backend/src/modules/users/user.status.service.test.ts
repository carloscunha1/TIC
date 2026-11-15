import { describe, expect, it, jest } from '@jest/globals';
import type { User } from '@prisma/client';
import type { UserUpdateRepository } from '../auth/user.repository.js';
import { LastActiveAdminError } from '../auth/user.repository.js';
import { UserStatusService } from './user.status.service.js';

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

function repository(updateStatus: UserUpdateRepository['updateStatus']): UserUpdateRepository {
  return { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus };
}

describe('UserStatusService.update', () => {
  it('updates a user status', async () => {
    const repo = repository(jest.fn(async () => ({ ...user, status: 'INACTIVE' })));
    await expect(new UserStatusService(repo).update(user.id, 'INACTIVE')).resolves.toMatchObject({ status: 'INACTIVE' });
  });

  it('rejects deactivation of the last active administrator', async () => {
    const repo = repository(jest.fn(async () => { throw new LastActiveAdminError(); }));
    await expect(new UserStatusService(repo).update(user.id, 'INACTIVE')).rejects.toMatchObject({ code: 'LAST_ACTIVE_ADMIN', statusCode: 409 });
  });
});
