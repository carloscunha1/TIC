import { describe, expect, it, jest } from '@jest/globals';
import type { CustomerAuthRepository, CustomerForLogin, CustomerLoginUnitOfWork } from './customer-auth.repository.js';
import { CustomerAuthService } from './customer-auth.service.js';

function setup(customer: CustomerForLogin | null) {
  const unit: CustomerLoginUnitOfWork = {
    recordFailure: jest.fn(async () => undefined), recordRejected: jest.fn(async () => undefined),
    resetFailures: jest.fn(async () => undefined),
    createSession: jest.fn(async (data) => ({ ...data, lastActivityAt: new Date(), revokedAt: null, createdAt: new Date() } as never)),
  };
  const repository: CustomerAuthRepository = {
    requestPinSetup: jest.fn(async () => undefined), completePinSetup: jest.fn(async () => 'INITIAL'),
    withLockedCustomerByPhone: jest.fn(async (_phone, operation) => operation(customer, unit)),
  };
  const service = new CustomerAuthService(repository, {
    hashPin: async (pin) => `hashed:${pin}`, comparePin: async (pin, hash) => hash === `hashed:${pin}`,
    now: () => new Date('2026-11-15T12:00:00.000Z'), createToken: () => 'a'.repeat(43),
  });
  return { service, repository, unit };
}
const customer: CustomerForLogin = { id: 'customer-id', name: 'Ana', status: 'ACTIVE', pinHash: 'hashed:123456', pinFailedAttempts: 4, pinLockedUntil: null };

describe('CustomerAuthService', () => {
  it('persists a hashed one-time link request without exposing the stored token', async () => {
    const { service, repository } = setup(customer);
    const result = await service.startPinSetup('customer-id', 'operator-id');
    expect(result.setupUrl).toContain('/fidelidade/definir-pin#token=');
    expect(repository.requestPinSetup).toHaveBeenCalledWith('customer-id', expect.any(String), new Date('2026-11-15T12:15:00.000Z'), 'operator-id', undefined);
    expect(result.setupUrl).toContain('a'.repeat(43));
  });
  it('stores failures and locks the account for fifteen minutes on the fifth wrong attempt', async () => {
    const { service, unit } = setup(customer);
    await expect(service.login({ phone: '5516999999999', pin: '000000' })).rejects.toMatchObject({ code: 'INVALID_CUSTOMER_CREDENTIALS' });
    expect(unit.recordFailure).toHaveBeenCalledWith('customer-id', 5, new Date('2026-11-15T12:15:00.000Z'), undefined);
  });
  it('returns identical unauthorized errors for unknown customers and wrong PINs', async () => {
    const unknown = setup(null);
    const wrong = setup(customer);
    const outcomes = await Promise.all([
      unknown.service.login({ phone: '5516000000000', pin: '000000' }).catch((error: unknown) => error),
      wrong.service.login({ phone: '5516999999999', pin: '000000' }).catch((error: unknown) => error),
    ]);
    expect(outcomes.map((error) => [ (error as { statusCode: number }).statusCode, (error as { code: string }).code ])).toEqual([[401, 'INVALID_CUSTOMER_CREDENTIALS'], [401, 'INVALID_CUSTOMER_CREDENTIALS']]);
    expect(unknown.unit.recordRejected).toHaveBeenCalled();
  });
  it('creates a session and clears previous failure state on valid PIN', async () => {
    const { service, unit } = setup(customer);
    await expect(service.login({ phone: '55 (16) 99999-9999', pin: '123456' })).resolves.toMatchObject({ sessionToken: 'a'.repeat(43), expiresAt: new Date('2026-11-15T12:05:00.000Z') });
    expect(unit.resetFailures).toHaveBeenCalledWith('customer-id');
    expect(unit.createSession).toHaveBeenCalled();
  });
});
