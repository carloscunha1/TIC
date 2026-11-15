import { describe, expect, it, jest } from '@jest/globals';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

function repository(): AuditRepository {
  return { create: jest.fn(async () => undefined) };
}

describe('AuditService.record', () => {
  it('records a user event and recursively filters sensitive fields', async () => {
    const repo = repository();
    await new AuditService(repo).record({
      actor: { type: 'USER', userId: 'user-id' },
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: 'entity-id',
      after: { name: 'Maria', passwordHash: 'hash', nested: { token: 'secret' } },
      ipAddress: '127.0.0.1',
    });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      actorType: 'USER',
      actorUserId: 'user-id',
      afterData: { name: 'Maria', passwordHash: '[REDACTED]', nested: { token: '[REDACTED]' } },
    }), undefined);
  });

  it('supports SYSTEM actors without a user id', async () => {
    const repo = repository();
    await new AuditService(repo).record({ actor: { type: 'SYSTEM' }, action: 'JOB_RUN', entity: 'Job' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'SYSTEM', actorUserId: undefined }), undefined);
  });

  it('serializes dates inside audit snapshots for Prisma JSON fields', async () => {
    const repo = repository();
    const createdAt = new Date('2026-11-15T01:00:00.000Z');
    await new AuditService(repo).record({ actor: { type: 'SYSTEM' }, action: 'PRODUCT_CREATED', entity: 'Product', after: { createdAt, nested: { updatedAt: createdAt } } });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      afterData: { createdAt: '2026-11-15T01:00:00.000Z', nested: { updatedAt: '2026-11-15T01:00:00.000Z' } },
    }), undefined);
  });
});
