import { ApiError } from '../../shared/http/api-error.js';
import type { LoyaltyPolicyRepository } from './loyalty-policy.repository.js';
import { updateLoyaltyPolicySchema, type UpdateLoyaltyPolicyInput } from './loyalty-policy.schemas.js';

export class LoyaltyPolicyService {
  constructor(private readonly repository: LoyaltyPolicyRepository) {}

  async current() {
    const policy = await this.repository.current();
    if (!policy) throw new ApiError(503, 'LOYALTY_POLICY_NOT_INITIALIZED', 'A política de fidelidade ainda não foi inicializada.');
    return policy;
  }

  history() { return this.repository.history(); }

  async update(input: UpdateLoyaltyPolicyInput, actorUserId: string, ipAddress?: string) {
    const values = updateLoyaltyPolicySchema.parse(input);
    try {
      return await this.repository.createVersion({ ...values, actorUserId, ipAddress });
    } catch (error) {
      if (error instanceof Error && error.message === 'LOYALTY_POLICY_NOT_INITIALIZED') throw new ApiError(503, 'LOYALTY_POLICY_NOT_INITIALIZED', 'A política de fidelidade ainda não foi inicializada.');
      if (error instanceof Error && error.message === 'LOYALTY_POLICY_VERSION_CONFLICT') throw new ApiError(409, 'LOYALTY_POLICY_VERSION_CONFLICT', 'A política foi alterada por outro administrador. Recarregue os dados.');
      throw error;
    }
  }
}
