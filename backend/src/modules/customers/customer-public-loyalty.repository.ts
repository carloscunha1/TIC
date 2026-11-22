import { prisma } from '../../infrastructure/database/prisma.js';

export type PublicLoyaltyCredit = {
  id: string;
  pointsGranted: number;
  expiresAt: Date;
  allocations: Array<{ type: 'CONSUME' | 'RESTORE' | 'REVERSE' | 'COMPENSATE'; points: number }>;
};

export type PublicLoyaltyMovement = {
  id: string;
  type: 'CREDIT' | 'REDEMPTION' | 'EXPIRATION' | 'REVERSAL' | 'COMPENSATION';
  pointsDelta: number;
  createdAt: Date;
};

export interface CustomerPublicLoyaltyRepository {
  creditsNearExpiration(customerId: string, now: Date, until: Date): Promise<PublicLoyaltyCredit[]>;
  history(customerId: string): Promise<PublicLoyaltyMovement[]>;
}

export class PrismaCustomerPublicLoyaltyRepository implements CustomerPublicLoyaltyRepository {
  async creditsNearExpiration(customerId: string, now: Date, until: Date): Promise<PublicLoyaltyCredit[]> {
    return prisma.loyaltyCredit.findMany({
      where: { customerId, expiresAt: { gt: now, lte: until } },
      select: {
        id: true,
        pointsGranted: true,
        expiresAt: true,
        allocations: { select: { type: true, points: true } },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    });
  }

  async history(customerId: string): Promise<PublicLoyaltyMovement[]> {
    return prisma.loyaltyMovement.findMany({
      where: { customerId },
      select: { id: true, type: true, pointsDelta: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
}
