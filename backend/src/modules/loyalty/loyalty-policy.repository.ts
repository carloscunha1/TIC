import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type PolicyValues = { id: string; version: number; pointsPerRealSpent: number; redemptionPointsPerReal: number; isActive: boolean; createdAt: Date };
export interface LoyaltyPolicyRepository {
  current(): Promise<PolicyValues | null>;
  history(): Promise<PolicyValues[]>;
  createVersion(input: { expectedVersion: number; pointsPerRealSpent: number; redemptionPointsPerReal: number; actorUserId: string; ipAddress?: string }): Promise<{ policy: PolicyValues; changed: boolean }>;
}

export class PrismaLoyaltyPolicyRepository implements LoyaltyPolicyRepository {
  constructor(private readonly auditService: AuditService) {}

  current(): Promise<PolicyValues | null> {
    return prisma.loyaltyPolicy.findFirst({ where: { isActive: true }, select: policySelect, orderBy: { version: 'desc' } });
  }

  history(): Promise<PolicyValues[]> {
    return prisma.loyaltyPolicy.findMany({ select: policySelect, orderBy: { version: 'desc' } });
  }

  createVersion(input: { expectedVersion: number; pointsPerRealSpent: number; redemptionPointsPerReal: number; actorUserId: string; ipAddress?: string }): Promise<{ policy: PolicyValues; changed: boolean }> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(42043) IS NULL`;
      const rows = await tx.$queryRaw<Array<{ id: string; version: number; points_per_real_spent: number; redemption_points_per_real: number }>>`SELECT "id", "version", "points_per_real_spent", "redemption_points_per_real" FROM "loyalty_policies" WHERE "is_active" = true FOR UPDATE`;
      const active = rows[0];
      if (!active) throw new Error('LOYALTY_POLICY_NOT_INITIALIZED');
      if (active.version !== input.expectedVersion) throw new Error('LOYALTY_POLICY_VERSION_CONFLICT');
      if (active.points_per_real_spent === input.pointsPerRealSpent && active.redemption_points_per_real === input.redemptionPointsPerReal) {
        const policy = await tx.loyaltyPolicy.findUniqueOrThrow({ where: { id: active.id }, select: policySelect });
        return { policy, changed: false };
      }

      await tx.loyaltyPolicy.update({ where: { id: active.id }, data: { isActive: false } });
      const policy = await tx.loyaltyPolicy.create({
        data: {
          version: active.version + 1,
          pointsPerRealSpent: input.pointsPerRealSpent,
          redemptionPointsPerReal: input.redemptionPointsPerReal,
          isActive: true,
          createdByUserId: input.actorUserId,
        },
        select: policySelect,
      });
      await this.auditService.record({
        actor: { type: 'USER', userId: input.actorUserId },
        action: 'LOYALTY_POLICY_CHANGED',
        entity: 'LoyaltyPolicy',
        entityId: policy.id,
        before: { version: active.version, pointsPerRealSpent: active.points_per_real_spent, redemptionPointsPerReal: active.redemption_points_per_real },
        after: { version: policy.version, pointsPerRealSpent: policy.pointsPerRealSpent, redemptionPointsPerReal: policy.redemptionPointsPerReal },
        ipAddress: input.ipAddress,
      }, tx);
      return { policy, changed: true };
    });
  }
}

const policySelect = {
  id: true,
  version: true,
  pointsPerRealSpent: true,
  redemptionPointsPerReal: true,
  isActive: true,
  createdAt: true,
} as const;
