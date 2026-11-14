import bcrypt from 'bcryptjs';
import { describe, expect, it } from '@jest/globals';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service.js';
import type { SessionRepository } from './session.repository.js';
import type { UserRepository } from './user.repository.js';

const user = (overrides: Partial<User> = {}): User => ({
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Administrador',
  email: 'admin@example.com',
  passwordHash: '',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function createService(foundUser: User | null) {
  const userRepository: UserRepository = { findByEmail: async () => foundUser };
  const createdSessions: Array<{ id: string; userId: string; tokenHash: string; expiresAt: Date }> = [];
  const sessionRepository: SessionRepository = {
    create: async (input) => {
      createdSessions.push(input);
      return { ...input, lastActivityAt: new Date(), revokedAt: null, createdAt: new Date() } as never;
    },
  };
  return { service: new AuthService({ jwtSecret: 'test-secret', sessionRepository, userRepository }), createdSessions };
}

describe('AuthService.login', () => {
  it('creates a session for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const { service, createdSessions } = createService(user({ passwordHash }));

    const result = await service.login({ email: 'admin@example.com', password: 'correct-password' });

    expect(result.token).toEqual(expect.any(String));
    expect(createdSessions).toHaveLength(1);
    expect(createdSessions[0].userId).toBe(user().id);
  });

  it('returns the same generic error for invalid credentials', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const { service } = createService(user({ passwordHash }));

    await expect(service.login({ email: 'admin@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('does not authenticate inactive users', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const { service } = createService(user({ passwordHash, status: 'INACTIVE' }));

    await expect(service.login({ email: 'admin@example.com', password: 'correct-password' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });
});
