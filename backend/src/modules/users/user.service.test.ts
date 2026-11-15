import bcrypt from 'bcryptjs';
import { describe, expect, it, jest } from '@jest/globals';
import type { User } from '@prisma/client';
import type { UserCreationRepository } from '../auth/user.repository.js';
import { UserService } from './user.service.js';

const baseUser: User = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Operador',
  email: 'operador@example.com',
  passwordHash: 'hash',
  role: 'OPERATOR',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repository(existingUser: User | null = null): UserCreationRepository {
  return {
    create: jest.fn(async (input) => ({ ...baseUser, ...input })),
    findByEmail: jest.fn(async () => existingUser),
  };
}

describe('UserService.create', () => {
  it('creates an active user and stores only a password hash', async () => {
    const repo = repository();
    const service = new UserService(repo);

    const result = await service.create({
      email: ' Novo@Example.com ',
      name: 'Novo Operador',
      password: 'uma-senha-segura-123',
      role: 'OPERATOR',
    });

    expect(result).toMatchObject({ email: 'novo@example.com', role: 'OPERATOR', status: 'ACTIVE' });
    const createInput = (repo.create as jest.Mock).mock.calls[0][0] as { passwordHash: string };
    expect(createInput.passwordHash).not.toBe('uma-senha-segura-123');
    expect(await bcrypt.compare('uma-senha-segura-123', createInput.passwordHash)).toBe(true);
  });

  it('rejects duplicate e-mail', async () => {
    const repo = repository(baseUser);
    const service = new UserService(repo);

    await expect(service.create({
      email: baseUser.email,
      name: 'Outro Usuário',
      password: 'uma-senha-segura-123',
      role: 'VIEWER',
    })).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 });
  });
});
