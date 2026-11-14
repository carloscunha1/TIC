import bcrypt from 'bcryptjs';
import { describe, expect, it, jest } from '@jest/globals';
import type { User } from '@prisma/client';
import type { PasswordResetRepository } from '../auth/user.repository.js';
import { UserNotFoundError } from '../auth/user.repository.js';
import { PasswordResetService } from './password-reset.service.js';

const user: User = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Administrador',
  email: 'admin@example.com',
  passwordHash: 'old-hash',
  role: 'ADMIN',
  status: 'ACTIVE',
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  mustChangePassword: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repository(): PasswordResetRepository {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(async () => user),
    createPasswordReset: jest.fn(async () => user),
    completePasswordReset: jest.fn(async () => user),
  };
}

describe('PasswordResetService', () => {
  it('issues a random token and stores only its hash', async () => {
    const repo = repository();
    const result = await new PasswordResetService(repo).issue(user.id);
    const [id, data] = (repo.createPasswordReset as jest.Mock).mock.calls[0] as [string, { tokenHash: string; expiresAt: Date }];
    expect(id).toBe(user.id);
    expect(result.token).toHaveLength(43);
    expect(data.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('hashes the new password and consumes the token through the repository', async () => {
    const repo = repository();
    await new PasswordResetService(repo).complete('a'.repeat(43), 'uma-senha-nova-segura');
    const [tokenHash, passwordHash] = (repo.completePasswordReset as jest.Mock).mock.calls[0] as [string, string, Date];
    expect(tokenHash).not.toBe('a'.repeat(43));
    await expect(bcrypt.compare('uma-senha-nova-segura', passwordHash)).resolves.toBe(true);
  });

  it('rejects an invalid or expired token without revealing details', async () => {
    const repo = repository();
    repo.completePasswordReset = jest.fn(async () => { throw new UserNotFoundError(); });
    await expect(new PasswordResetService(repo).complete('a'.repeat(43), 'uma-senha-nova-segura')).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN', statusCode: 400 });
  });
});
