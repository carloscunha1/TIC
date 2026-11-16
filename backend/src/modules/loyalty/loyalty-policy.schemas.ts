import { z } from 'zod';

const positiveInteger = z.number().int().min(1).max(2_147_483_647);
export const updateLoyaltyPolicySchema = z.object({
  expectedVersion: positiveInteger,
  pointsPerRealSpent: positiveInteger,
  redemptionPointsPerReal: positiveInteger,
}).strict();
export type UpdateLoyaltyPolicyInput = z.infer<typeof updateLoyaltyPolicySchema>;
