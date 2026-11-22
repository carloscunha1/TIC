import type { LoyaltyService } from '../loyalty/loyalty.service.js';
import type { CustomerPublicLoyaltyRepository } from './customer-public-loyalty.repository.js';

const NEAR_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

export class CustomerPublicLoyaltyService {
  constructor(
    private readonly repository: CustomerPublicLoyaltyRepository,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async getSummary(customerId: string, now = new Date()) {
    const [balance, credits, history] = await Promise.all([
      this.loyaltyService.balance(customerId),
      this.repository.creditsNearExpiration(customerId, now, new Date(now.getTime() + NEAR_EXPIRATION_MS)),
      this.repository.history(customerId),
    ]);
    const nearExpiration = credits.map((credit) => {
      const used = credit.allocations.reduce(
        (sum, allocation) => sum + (allocation.type === 'RESTORE' ? -allocation.points : allocation.points),
        0,
      );
      return {
        creditId: credit.id,
        points: Math.max(0, credit.pointsGranted - used),
        expiresAt: credit.expiresAt,
      };
    }).filter((credit) => credit.points > 0);
    return {
      availablePoints: balance.availablePoints,
      nearExpiration,
      history: history.map((movement) => ({
        id: movement.id,
        type: movement.type,
        points: movement.pointsDelta,
        createdAt: movement.createdAt,
      })),
    };
  }
}
