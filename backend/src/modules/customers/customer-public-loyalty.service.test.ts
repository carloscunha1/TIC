import { describe, expect, it, jest } from '@jest/globals';
import type { LoyaltyService } from '../loyalty/loyalty.service.js';
import type { CustomerPublicLoyaltyRepository } from './customer-public-loyalty.repository.js';
import { CustomerPublicLoyaltyService } from './customer-public-loyalty.service.js';

describe('CustomerPublicLoyaltyService', () => {
  it('returns only the customer balance, credits near expiration and allowed history', async () => {
    const now = new Date('2026-11-21T12:00:00.000Z');
    const repository: CustomerPublicLoyaltyRepository = {
      creditsNearExpiration: jest.fn(async () => [{
        id: 'credit-1',
        pointsGranted: 40,
        expiresAt: new Date('2026-12-10T12:00:00.000Z'),
        allocations: [{ type: 'CONSUME', points: 10 }],
      }]),
      history: jest.fn(async () => [{
        id: 'movement-1',
        type: 'CREDIT',
        pointsDelta: 40,
        createdAt: now,
      }]),
    };
    const loyalty = { balance: jest.fn(async () => ({ availablePoints: 30, debtPoints: 0 })) } as unknown as LoyaltyService;
    const service = new CustomerPublicLoyaltyService(repository, loyalty);

    await expect(service.getSummary('customer-1', now)).resolves.toEqual({
      availablePoints: 30,
      nearExpiration: [{ creditId: 'credit-1', points: 30, expiresAt: new Date('2026-12-10T12:00:00.000Z') }],
      history: [{ id: 'movement-1', type: 'CREDIT', points: 40, createdAt: now }],
    });
  });

  it('filters credits that are fully consumed', async () => {
    const now = new Date('2026-11-21T12:00:00.000Z');
    const repository: CustomerPublicLoyaltyRepository = {
      creditsNearExpiration: jest.fn(async () => [{
        id: 'credit-1',
        pointsGranted: 20,
        expiresAt: new Date('2026-12-10T12:00:00.000Z'),
        allocations: [{ type: 'CONSUME', points: 20 }],
      }]),
      history: jest.fn(async () => []),
    };
    const loyalty = { balance: jest.fn(async () => ({ availablePoints: 0, debtPoints: 0 })) } as unknown as LoyaltyService;

    await expect(new CustomerPublicLoyaltyService(repository, loyalty).getSummary('customer-1', now)).resolves.toMatchObject({ nearExpiration: [] });
  });
});
