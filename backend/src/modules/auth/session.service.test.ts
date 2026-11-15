import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { jest, describe, expect, it } from '@jest/globals';
import type { Session, User } from '@prisma/client';
import { SessionService } from './session.service.js';
import type { SessionRepository } from './session.repository.js';

const secret = 'test-secret';
const user = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
} as User;

function createSession(lastActivityAt = new Date()): Session & { user: User } {
  return {
    id: 'e4a0f4b4-2cf6-4f4c-bb79-e24e3b3c7fcb',
    userId: user.id,
    tokenHash: '',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActivityAt,
    revokedAt: null,
    createdAt: new Date(),
    user,
  };
}

function tokenFor(session: Session): string {
  return jwt.sign({ sid: session.id, sub: session.userId }, secret, { expiresIn: 1800 });
}

describe('SessionService', () => {
  it('renews an active session and rotates its token hash', async () => {
    const session = createSession();
    const token = tokenFor(session);
    session.tokenHash = createHash('sha256').update(token).digest('hex');
    const repository: SessionRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => session),
      renew: jest.fn(async () => undefined),
      revoke: jest.fn(async () => undefined),
    };
    const service = new SessionService({ jwtSecret: secret, sessionRepository: repository });

    const result = await service.authenticate(token);

    expect(result.userId).toBe(user.id);
    expect(result.renewedToken).not.toBe(token);
    expect(repository.renew).toHaveBeenCalledWith(session.id, expect.objectContaining({ tokenHash: expect.any(String) }));
  });

  it('revokes an inactive session', async () => {
    const session = createSession(new Date(Date.now() - 30 * 60 * 1000));
    const token = tokenFor(session);
    session.tokenHash = createHash('sha256').update(token).digest('hex');
    const repository: SessionRepository = {
      create: jest.fn(),
      findById: jest.fn(async () => session),
      renew: jest.fn(async () => undefined),
      revoke: jest.fn(async () => undefined),
    };
    const service = new SessionService({ jwtSecret: secret, sessionRepository: repository });

    await expect(service.authenticate(token)).rejects.toMatchObject({ code: 'INVALID_SESSION', statusCode: 401 });
    expect(repository.revoke).toHaveBeenCalledWith(session.id, expect.any(Date));
  });

  it('invalidates a session on logout', async () => {
    const session = createSession();
    const token = tokenFor(session);
    const repository: SessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      renew: jest.fn(),
      revoke: jest.fn(async () => undefined),
    };
    const service = new SessionService({ jwtSecret: secret, sessionRepository: repository });

    await service.logout(token);

    expect(repository.revoke).toHaveBeenCalledWith(session.id, expect.any(Date));
  });
});
