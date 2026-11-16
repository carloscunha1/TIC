import type { CustomerStatus, LoyaltyAllocation, LoyaltyAllocationType, LoyaltyCredit, LoyaltyMovement, LoyaltyMovementType, LoyaltyPolicy, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export type LockedCustomer = { id: string; status: CustomerStatus };
export type CreditLedgerState = LoyaltyCredit & { allocations: Array<Pick<LoyaltyAllocation, 'type' | 'points'> & { movement: Pick<LoyaltyMovement, 'type'> }> };
export type MovementWithAllocations = LoyaltyMovement & { allocations: Array<Pick<LoyaltyAllocation, 'type' | 'points' | 'creditId'> & { credit: LoyaltyCredit }> };
export type ReversalSummary = Pick<LoyaltyMovement, 'id' | 'pointsDelta'>;
export type NewMovement = {
  id: string;
  customerId: string;
  type: LoyaltyMovementType;
  pointsDelta: number;
  sourceType: string;
  sourceId?: string | null;
  reason?: string | null;
  creditId?: string | null;
  reversalOfId?: string | null;
  reversalOfCreditId?: string | null;
  actorUserId?: string | null;
  redemptionValueCents?: bigint | null;
};

export interface LoyaltyUnitOfWork {
  lockCustomer(customerId: string): Promise<LockedCustomer | null>;
  currentPolicy(): Promise<Pick<LoyaltyPolicy, 'id' | 'pointsPerRealSpent' | 'redemptionPointsPerReal'> | null>;
  balance(customerId: string): Promise<number>;
  creditBySource(sourceType: string, sourceId: string): Promise<CreditLedgerState | null>;
  creditById(creditId: string): Promise<CreditLedgerState | null>;
  movementBySource(sourceType: string, sourceId: string, type: LoyaltyMovementType): Promise<MovementWithAllocations | null>;
  movementById(id: string): Promise<MovementWithAllocations | null>;
  reversalsOfMovement(id: string): Promise<MovementWithAllocations[]>;
  reversalsOfCredit(creditId: string): Promise<ReversalSummary[]>;
  creditsForCustomer(customerId: string): Promise<CreditLedgerState[]>;
  dueCredits(now: Date): Promise<CreditLedgerState[]>;
  createCredit(data: Prisma.LoyaltyCreditUncheckedCreateInput): Promise<LoyaltyCredit>;
  createMovement(data: NewMovement): Promise<LoyaltyMovement>;
  createAllocation(data: { id: string; movementId: string; creditId: string; customerId: string; type: LoyaltyAllocationType; points: number }): Promise<LoyaltyAllocation>;
}

export interface LoyaltyRepository {
  transaction<T>(transaction: Prisma.TransactionClient | undefined, operation: (unit: LoyaltyUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaLoyaltyRepository implements LoyaltyRepository {
  transaction<T>(transaction: Prisma.TransactionClient | undefined, operation: (unit: LoyaltyUnitOfWork) => Promise<T>): Promise<T> {
    const run = (tx: Prisma.TransactionClient) => operation(new PrismaLoyaltyUnitOfWork(tx));
    return transaction ? run(transaction) : prisma.$transaction(run);
  }
}

class PrismaLoyaltyUnitOfWork implements LoyaltyUnitOfWork {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async lockCustomer(customerId: string): Promise<LockedCustomer | null> {
    await this.tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId}::uuid FOR UPDATE`;
    return this.tx.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true } });
  }

  currentPolicy() {
    return this.tx.loyaltyPolicy.findFirst({ where: { isActive: true }, select: { id: true, pointsPerRealSpent: true, redemptionPointsPerReal: true } });
  }

  async balance(customerId: string) {
    const result = await this.tx.loyaltyMovement.aggregate({ where: { customerId }, _sum: { pointsDelta: true } });
    return result._sum.pointsDelta ?? 0;
  }

  creditBySource(sourceType: string, sourceId: string) {
    return this.tx.loyaltyCredit.findUnique({ where: { sourceType_sourceId: { sourceType, sourceId } }, include: creditLedgerInclude });
  }

  creditById(creditId: string) {
    return this.tx.loyaltyCredit.findUnique({ where: { id: creditId }, include: creditLedgerInclude });
  }

  movementBySource(sourceType: string, sourceId: string, type: LoyaltyMovementType) {
    return this.tx.loyaltyMovement.findUnique({ where: { sourceType_sourceId_type: { sourceType, sourceId, type } }, include: movementAllocationsInclude });
  }

  movementById(id: string) {
    return this.tx.loyaltyMovement.findUnique({ where: { id }, include: movementAllocationsInclude });
  }

  reversalsOfMovement(id: string) {
    return this.tx.loyaltyMovement.findMany({ where: { reversalOfId: id, type: 'REVERSAL' }, include: movementAllocationsInclude, orderBy: { createdAt: 'asc' } });
  }

  reversalsOfCredit(creditId: string) {
    return this.tx.loyaltyMovement.findMany({ where: { reversalOfCreditId: creditId, type: 'REVERSAL' }, select: { id: true, pointsDelta: true } });
  }

  creditsForCustomer(customerId: string) {
    return this.tx.loyaltyCredit.findMany({ where: { customerId }, include: creditLedgerInclude, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  }

  dueCredits(now: Date) {
    return this.tx.loyaltyCredit.findMany({ where: { expiresAt: { lte: now } }, include: creditLedgerInclude, orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  }

  createCredit(data: Prisma.LoyaltyCreditUncheckedCreateInput) {
    return this.tx.loyaltyCredit.create({ data });
  }

  createMovement(data: NewMovement) {
    return this.tx.loyaltyMovement.create({ data });
  }

  createAllocation(data: { id: string; movementId: string; creditId: string; customerId: string; type: LoyaltyAllocationType; points: number }) {
    return this.tx.loyaltyAllocation.create({ data });
  }
}

const creditLedgerInclude = { allocations: { include: { movement: { select: { type: true } } } } } satisfies Prisma.LoyaltyCreditInclude;
const movementAllocationsInclude = { allocations: { include: { credit: true }, orderBy: { createdAt: 'asc' } } } satisfies Prisma.LoyaltyMovementInclude;
