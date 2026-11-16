import { describe, expect, it, jest } from '@jest/globals';
import type { CustomerSessionRepository, CustomerSessionWithCustomer } from './customer-session.repository.js';
import { CustomerSessionService } from './customer-session.service.js';
import { hashToken } from './customer-auth.service.js';
const now = new Date('2026-11-15T12:00:00.000Z');
function session(overrides: Partial<CustomerSessionWithCustomer> = {}): CustomerSessionWithCustomer {
  return { id: 'session-id', customerId: 'customer-id', tokenHash: hashToken('opaque-token'), expiresAt: new Date('2026-11-15T12:05:00.000Z'), lastActivityAt: new Date('2026-11-15T11:59:00.000Z'), revokedAt: null, createdAt: now, customer: { id: 'customer-id', name: 'Ana', status: 'ACTIVE' }, ...overrides } as CustomerSessionWithCustomer;
}
describe('CustomerSessionService', () => {
  it('renews the five-minute idle window on activity', async () => {
    const repository: CustomerSessionRepository = { find: jest.fn(async () => session()), renew: jest.fn(async () => undefined), revoke: jest.fn(async () => undefined) };
    await expect(new CustomerSessionService(repository, () => now).authenticate('opaque-token')).resolves.toMatchObject({ customerId: 'customer-id', expiresAt: new Date('2026-11-15T12:05:00.000Z') });
    expect(repository.renew).toHaveBeenCalledWith('session-id', new Date('2026-11-15T12:05:00.000Z'), now);
  });
  it('revokes sessions idle for five minutes and rejects inactive customers', async () => {
    for (const stale of [session({ lastActivityAt: new Date('2026-11-15T11:54:59.999Z') }), session({ customer: { id: 'customer-id', name: 'Ana', status: 'INACTIVE' } })]) {
      const repository: CustomerSessionRepository = { find: jest.fn(async () => stale), renew: jest.fn(async () => undefined), revoke: jest.fn(async () => undefined) };
      await expect(new CustomerSessionService(repository, () => now).authenticate('opaque-token')).rejects.toMatchObject({ code: 'INVALID_CUSTOMER_SESSION' });
      expect(repository.revoke).toHaveBeenCalledWith(stale.tokenHash, now);
    }
  });
});
