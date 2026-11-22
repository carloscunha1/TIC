import { describe, expect, it, jest } from '@jest/globals';
import type { AuditReadRepository } from './audit-read.repository.js';
import { AuditReadService } from './audit-read.service.js';

describe('AuditReadService', () => {
  it('lists audit records and redacts credential-shaped fields', async () => {
    const repository = {
      list: jest.fn(async () => ({
        logs: [{
          id: 'log-1',
          actorType: 'USER',
          actorUserId: 'user-1',
          actorUser: { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
          action: 'USER_UPDATED',
          entity: 'User',
          entityId: 'user-1',
          beforeData: { name: 'Ana', pin: '123456', password: 'secret' },
          afterData: { name: 'Ana Maria', token: 'abc123' },
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-11-21T12:00:00.000Z'),
        }],
        total: 1,
      })),
    } as unknown as AuditReadRepository;

    await expect(new AuditReadService(repository).list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      logs: [{
        before: { name: 'Ana', pin: '[REDACTED]', password: '[REDACTED]' },
        after: { name: 'Ana Maria', token: '[REDACTED]' },
      }],
    });
  });

  it('supports system actors without a user', async () => {
    const repository = {
      list: jest.fn(async () => ({
        logs: [{
          id: 'log-2',
          actorType: 'SYSTEM',
          actorUserId: null,
          actorUser: null,
          action: 'SALE_DRAFT_EXPIRED',
          entity: 'Sale',
          entityId: 'sale-1',
          beforeData: null,
          afterData: { status: 'CANCELADA' },
          ipAddress: null,
          createdAt: new Date('2026-11-21T12:00:00.000Z'),
        }],
        total: 1,
      })),
    } as unknown as AuditReadRepository;

    await expect(new AuditReadService(repository).list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      logs: [{ actorType: 'SYSTEM', actor: null, action: 'SALE_DRAFT_EXPIRED' }],
    });
  });
});
