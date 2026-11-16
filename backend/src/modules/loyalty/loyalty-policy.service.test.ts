import { describe, expect, it, jest } from '@jest/globals';
import type { LoyaltyPolicyRepository, PolicyValues } from './loyalty-policy.repository.js';
import { LoyaltyPolicyService } from './loyalty-policy.service.js';
const policy: PolicyValues = { id: 'policy-1', version: 2, pointsPerRealSpent: 1, redemptionPointsPerReal: 100, isActive: true, createdAt: new Date('2026-11-15T12:00:00.000Z') };
function makeRepository(): LoyaltyPolicyRepository {
  return { current: jest.fn(async () => policy), history: jest.fn(async () => [policy]), createVersion: jest.fn(async () => ({ policy: { ...policy, version: 3, pointsPerRealSpent: 2 }, changed: true })) };
}
describe('LoyaltyPolicyService', () => {
  it('creates the next immutable version with the requested conversion values', async () => {
    const repository = makeRepository();
    await expect(new LoyaltyPolicyService(repository).update({ expectedVersion: 2, pointsPerRealSpent: 2, redemptionPointsPerReal: 80 }, 'admin-id', '127.0.0.1')).resolves.toMatchObject({ changed: true, policy: { version: 3, pointsPerRealSpent: 2 } });
    expect(repository.createVersion).toHaveBeenCalledWith({ expectedVersion: 2, pointsPerRealSpent: 2, redemptionPointsPerReal: 80, actorUserId: 'admin-id', ipAddress: '127.0.0.1' });
  });
  it('rejects invalid rates before persistence', async () => {
    const repository = makeRepository();
    await expect(new LoyaltyPolicyService(repository).update({ expectedVersion: 2, pointsPerRealSpent: 0, redemptionPointsPerReal: 100 }, 'admin-id')).rejects.toThrow();
    expect(repository.createVersion).not.toHaveBeenCalled();
  });
  it('maps concurrent policy changes to a conflict', async () => {
    const repository = makeRepository();
    jest.mocked(repository.createVersion).mockRejectedValue(new Error('LOYALTY_POLICY_VERSION_CONFLICT'));
    await expect(new LoyaltyPolicyService(repository).update({ expectedVersion: 1, pointsPerRealSpent: 2, redemptionPointsPerReal: 100 }, 'admin-id')).rejects.toMatchObject({ statusCode: 409, code: 'LOYALTY_POLICY_VERSION_CONFLICT' });
  });
});
