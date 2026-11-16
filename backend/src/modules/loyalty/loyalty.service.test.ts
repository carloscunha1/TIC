import { describe, expect, it, jest } from "@jest/globals";
import {
  Prisma,
  LoyaltyAllocationType,
  LoyaltyMovementType,
} from "@prisma/client";
import type {
  LoyaltyAllocation,
  LoyaltyCredit,
  LoyaltyMovement,
  LoyaltyPolicy,
} from "@prisma/client";
import type {
  CreditLedgerState,
  LoyaltyRepository,
  LoyaltyUnitOfWork,
  MovementWithAllocations,
  NewMovement,
} from "./loyalty.repository.js";
import { LoyaltyService } from "./loyalty.service.js";

const customerId = "d27691b5-3991-4e11-8313-c7902869b43a";
const sourceType = "SALE_AWARD";
const sourceId = "sale-001";
const now = new Date("2026-11-15T12:00:00.000Z");
const COMPENSATE = "COMPENSATE" as unknown as LoyaltyAllocationType;

type AllocationRow = {
  id: string;
  movementId: string;
  creditId: string;
  customerId: string;
  type: LoyaltyAllocationType;
  points: number;
};
class MemoryRepository implements LoyaltyRepository {
  credits: CreditLedgerState[] = [];
  movements: LoyaltyMovement[] = [];
  allocations: AllocationRow[] = [];
  status = "ACTIVE";
  policy = {
    id: "policy-id",
    pointsPerRealSpent: 1,
    redemptionPointsPerReal: 100,
  };
  async transaction<T>(
    _transaction: Prisma.TransactionClient | undefined,
    operation: (unit: LoyaltyUnitOfWork) => Promise<T>,
  ): Promise<T> {
    return operation(this.unit());
  }
  unit(): LoyaltyUnitOfWork {
    return {
      lockCustomer: async (id) =>
        id === customerId ? { id, status: this.status as never } : null,
      currentPolicy: async () => this.policy as LoyaltyPolicy,
      balance: async (id) =>
        this.movements
          .filter((movement) => movement.customerId === id)
          .reduce((sum, movement) => sum + movement.pointsDelta, 0),
      creditBySource: async (kind, id) =>
        this.credits.find(
          (credit) => credit.sourceType === kind && credit.sourceId === id,
        ) ?? null,
      creditById: async (id) =>
        this.credits.find((credit) => credit.id === id) ?? null,
      movementBySource: async (kind, id, type) =>
        this.movement(
          this.movements.find(
            (item) =>
              item.sourceType === kind &&
              item.sourceId === id &&
              item.type === type,
          ),
        ),
      movementById: async (id) =>
        this.movement(this.movements.find((item) => item.id === id)),
      reversalsOfMovement: async (id) =>
        this.movements
          .filter(
            (item) =>
              item.reversalOfId === id &&
              item.type === LoyaltyMovementType.REVERSAL,
          )
          .map((item) => this.movement(item)!),
      reversalsOfCredit: async (id) =>
        this.movements.filter(
          (item) =>
            item.reversalOfId === id &&
            item.type === LoyaltyMovementType.REVERSAL,
        ),
      creditsForCustomer: async (id) =>
        this.credits.filter((credit) => credit.customerId === id),
      dueCredits: async (at) =>
        this.credits.filter((credit) => credit.expiresAt <= at),
      createCredit: async (data) => {
        const credit = {
          ...data,
          createdAt: now,
          allocations: [],
        } as unknown as CreditLedgerState;
        this.credits.push(credit);
        return credit as LoyaltyCredit;
      },
      createMovement: async (data: NewMovement) => {
        const movement = {
          ...data,
          createdAt: now,
          redemptionValueCents: data.redemptionValueCents ?? null,
          reversalOfCreditId: data.reversalOfCreditId ?? null,
        } as LoyaltyMovement;
        this.movements.push(movement);
        return movement;
      },
      createAllocation: async (data) => {
        const allocation = { ...data, createdAt: now } as AllocationRow;
        this.allocations.push(allocation);
        const credit = this.credits.find(
          (item) => item.id === allocation.creditId,
        );
        if (credit) credit.allocations = this.creditAllocations(credit.id);
        return allocation as LoyaltyAllocation;
      },
    };
  }
  private movement(row?: LoyaltyMovement): MovementWithAllocations | null {
    if (!row) return null;
    return {
      ...row,
      allocations: this.allocations
        .filter((allocation) => allocation.movementId === row.id)
        .map((allocation) => ({
          ...allocation,
          credit: this.credits.find(
            (credit) => credit.id === allocation.creditId,
          )!,
        })),
    } as MovementWithAllocations;
  }
  private creditAllocations(
    creditId: string,
  ): CreditLedgerState["allocations"] {
    return this.allocations
      .filter((allocation) => allocation.creditId === creditId)
      .map((allocation) => ({
        type: allocation.type,
        points: allocation.points,
        movement: {
          type: this.movements.find(
            (movement) => movement.id === allocation.movementId,
          )!.type,
        },
      }));
  }
  addCredit(input: {
    id: string;
    points: number;
    expiry: Date;
    rate?: number;
    created?: Date;
  }) {
    const credit = {
      id: input.id,
      customerId,
      policyId: "policy-id",
      sourceType: "SALE_AWARD",
      sourceId: input.id,
      eligibleAmount: new Prisma.Decimal(input.points),
      pointsGranted: input.points,
      pointsPerRealSpent: 1,
      redemptionPointsPerReal: input.rate ?? 100,
      expiresAt: input.expiry,
      createdAt: input.created ?? now,
      allocations: [],
    } as unknown as CreditLedgerState;
    this.credits.push(credit);
    return credit;
  }
  addMovement(input: {
    id: string;
    type: LoyaltyMovementType;
    delta: number;
    sourceType?: string;
    sourceId?: string;
    creditId?: string;
    reversalOfId?: string;
    reversalOfCreditId?: string;
    redemptionValueCents?: bigint;
  }) {
    const movement = {
      id: input.id,
      customerId,
      type: input.type,
      pointsDelta: input.delta,
      sourceType: input.sourceType ?? "FIXTURE",
      sourceId: input.sourceId ?? input.id,
      creditId: input.creditId ?? null,
      reversalOfId: input.reversalOfId ?? null,
      reversalOfCreditId: input.reversalOfCreditId ?? null,
      redemptionValueCents: input.redemptionValueCents ?? null,
      reason: null,
      actorUserId: null,
      createdAt: now,
    } as LoyaltyMovement;
    this.movements.push(movement);
    return movement;
  }
  addAllocation(
    movementId: string,
    creditId: string,
    type: LoyaltyAllocationType,
    points: number,
  ) {
    this.allocations.push({
      id: `alloc-${this.allocations.length}`,
      movementId,
      creditId,
      customerId,
      type,
      points,
    });
    const credit = this.credits.find((item) => item.id === creditId);
    if (credit) credit.allocations = this.creditAllocations(creditId);
  }
}
function service(repo: MemoryRepository) {
  return new LoyaltyService(repo, { now: () => now });
}
function future(days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("LoyaltyService", () => {
  it("awards whole paid reais and uses new credits to compensate a negative balance first", async () => {
    const repo = new MemoryRepository();
    repo.addMovement({
      id: "debt",
      type: LoyaltyMovementType.REVERSAL,
      delta: -3,
    });
    const result = await service(repo).award({
      customerId,
      sourceType,
      sourceId,
      eligibleAmount: "15.90",
    });
    expect(result).toMatchObject({
      pointsGranted: 15,
      pointsCompensated: 3,
      pointsAvailable: 12,
    });
    expect(
      repo.movements.map((movement) => [movement.type, movement.pointsDelta]),
    ).toContainEqual([LoyaltyMovementType.COMPENSATION, 3]);
    expect(
      repo.allocations.find((item) => item.type === COMPENSATE)?.points,
    ).toBe(3);
    expect((await service(repo).balance(customerId)).availablePoints).toBe(12);
  });

  it("returns the original award on an identical retry and rejects changed payloads", async () => {
    const repo = new MemoryRepository();
    const loyalty = service(repo);
    await loyalty.award({
      customerId,
      sourceType,
      sourceId,
      eligibleAmount: "15.00",
    });
    const count = repo.movements.length;
    await expect(
      loyalty.award({
        customerId,
        sourceType,
        sourceId,
        eligibleAmount: "15.00",
      }),
    ).resolves.toMatchObject({ pointsGranted: 15 });
    await expect(
      loyalty.award({
        customerId,
        sourceType,
        sourceId,
        eligibleAmount: "16.00",
      }),
    ).rejects.toMatchObject({ code: "LOYALTY_IDEMPOTENCY_CONFLICT" });
    expect(repo.movements).toHaveLength(count);
  });

  it("redeems FEFO across credit snapshots and rounds the total value down to cents", async () => {
    const repo = new MemoryRepository();
    const early = repo.addCredit({
      id: "credit-early",
      points: 50,
      expiry: future(1),
      rate: 100,
      created: new Date(now.getTime() - 1000),
    });
    const later = repo.addCredit({
      id: "credit-later",
      points: 100,
      expiry: future(10),
      rate: 200,
    });
    repo.addMovement({
      id: "credit-move-early",
      type: LoyaltyMovementType.CREDIT,
      delta: 50,
      creditId: early.id,
    });
    repo.addMovement({
      id: "credit-move-later",
      type: LoyaltyMovementType.CREDIT,
      delta: 100,
      creditId: later.id,
    });
    const result = await service(repo).redeem({
      customerId,
      sourceType: "SALE_REDEMPTION",
      sourceId: "sale-002",
      points: 75,
    });
    expect(result.redemptionValueCents).toBe(62n);
    expect(
      repo.allocations
        .filter((item) => item.movementId === result.movement.id)
        .map((item) => [item.creditId, item.points]),
    ).toEqual([
      ["credit-early", 50],
      ["credit-later", 25],
    ]);
    expect(await service(repo).balance(customerId)).toMatchObject({
      availablePoints: 75,
      debtPoints: 0,
    });
  });

  it("rejects redemption while the effective balance is negative or insufficient", async () => {
    const negative = new MemoryRepository();
    negative.addMovement({
      id: "debt",
      type: LoyaltyMovementType.REVERSAL,
      delta: -2,
    });
    await expect(
      service(negative).redeem({
        customerId,
        sourceType: "SALE_REDEMPTION",
        sourceId: "sale-003",
        points: 1,
      }),
    ).rejects.toMatchObject({ code: "LOYALTY_NEGATIVE_BALANCE" });
    const insufficient = new MemoryRepository();
    await expect(
      service(insufficient).redeem({
        customerId,
        sourceType: "SALE_REDEMPTION",
        sourceId: "sale-004",
        points: 1,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_LOYALTY_POINTS" });
  });

  it("expires only the unused points once, retaining a traceable negative movement", async () => {
    const repo = new MemoryRepository();
    const credit = repo.addCredit({
      id: "expired-credit",
      points: 20,
      expiry: new Date(now.getTime() - 1),
    });
    const grant = repo.addMovement({
      id: "grant",
      type: LoyaltyMovementType.CREDIT,
      delta: 20,
      creditId: credit.id,
    });
    const redeem = repo.addMovement({
      id: "redeem",
      type: LoyaltyMovementType.REDEMPTION,
      delta: -7,
    });
    repo.addAllocation(redeem.id, credit.id, LoyaltyAllocationType.CONSUME, 7);
    const first = await service(repo).expireDueCredits();
    const second = await service(repo).expireDueCredits();
    expect(first).toEqual({ creditsExpired: 1, pointsExpired: 13 });
    expect(second).toEqual({ creditsExpired: 0, pointsExpired: 0 });
    expect(
      repo.movements.filter(
        (movement) => movement.sourceType === "CREDIT_EXPIRATION",
      ),
    ).toHaveLength(1);
    expect(
      repo.movements.find(
        (movement) => movement.sourceType === "CREDIT_EXPIRATION",
      )?.pointsDelta,
    ).toBe(-13);
    expect(grant.id).toBe("grant");
  });

  it("reverses only unexpired grant points and records debt for points already consumed", async () => {
    const repo = new MemoryRepository();
    const credit = repo.addCredit({
      id: "853cdd12-5c7c-4ed2-b7b6-a8352a01fbaa",
      points: 10,
      expiry: future(5),
    });
    credit.sourceType = sourceType;
    credit.sourceId = sourceId;
    const compensation = repo.addMovement({
      id: "compensation",
      type: LoyaltyMovementType.COMPENSATION,
      delta: 6,
      sourceType: sourceType,
      sourceId,
    });
    const grant = repo.addMovement({
      id: "grant",
      type: LoyaltyMovementType.CREDIT,
      delta: 4,
      sourceType,
      sourceId,
      creditId: credit.id,
    });
    repo.addAllocation(compensation.id, credit.id, COMPENSATE, 6);
    repo.addMovement({
      id: "old-debt",
      type: LoyaltyMovementType.REVERSAL,
      delta: -6,
    });
    const result = await service(repo).reverseAward({
      customerId,
      sourceType: "SALE_CREDIT_REVERSAL",
      sourceId: "cancel-1",
      creditId: credit.id,
    });
    expect(result).toMatchObject({ pointsReversed: 10, pointsDebtCreated: 6 });
    expect(result.movement?.reversalOfId).toBe(grant.id);
    expect(await service(repo).balance(customerId)).toMatchObject({
      availablePoints: 0,
      debtPoints: 6,
    });
  });

  it("returns the original award reversal on an identical retry", async () => {
    const repo = new MemoryRepository();
    const credit = repo.addCredit({
      id: "7a2c2d86-4dcb-4de5-8e7c-4bd6f78dc2ea",
      points: 10,
      expiry: future(5),
    });
    credit.sourceType = sourceType;
    credit.sourceId = sourceId;
    const grant = repo.addMovement({
      id: "idempotent-reversal-grant",
      type: LoyaltyMovementType.CREDIT,
      delta: 10,
      sourceType,
      sourceId,
      creditId: credit.id,
    });

    const input = {
      customerId,
      sourceType: "SALE_CREDIT_REVERSAL",
      sourceId: "idempotent-reversal",
      creditId: credit.id,
    };
    const loyalty = service(repo);
    const first = await loyalty.reverseAward(input);
    const movementCount = repo.movements.length;
    const second = await loyalty.reverseAward(input);

    expect(second).toMatchObject({
      movement: first.movement,
      pointsReversed: 10,
      pointsDebtCreated: 0,
    });
    expect(first.movement?.reversalOfId).toBe(grant.id);
    expect(repo.movements).toHaveLength(movementCount);
  });

  it("restores redeemed points to their original credits and expires the portion already past expiry", async () => {
    const repo = new MemoryRepository();
    const expired = repo.addCredit({
      id: "expired-redemption-credit",
      points: 6,
      expiry: new Date(now.getTime() - 1),
      rate: 100,
    });
    const active = repo.addCredit({
      id: "active-redemption-credit",
      points: 4,
      expiry: future(7),
      rate: 200,
    });
    repo.addMovement({
      id: "grant-expired",
      type: LoyaltyMovementType.CREDIT,
      delta: 6,
      creditId: expired.id,
    });
    repo.addMovement({
      id: "grant-active",
      type: LoyaltyMovementType.CREDIT,
      delta: 4,
      creditId: active.id,
    });
    const redemption = repo.addMovement({
      id: "c6682201-e2b6-4f67-b418-333dd6a9b0f8",
      type: LoyaltyMovementType.REDEMPTION,
      delta: -10,
      redemptionValueCents: 8n,
    });
    repo.addAllocation(
      redemption.id,
      expired.id,
      LoyaltyAllocationType.CONSUME,
      6,
    );
    repo.addAllocation(
      redemption.id,
      active.id,
      LoyaltyAllocationType.CONSUME,
      4,
    );
    const loyalty = service(repo);
    const result = await loyalty.reverseRedemption({
      customerId,
      sourceType: "SALE_REDEMPTION_REVERSAL",
      sourceId: "cancel-redemption-1",
      movementId: redemption.id,
    });
    expect(result).toMatchObject({
      pointsRestored: 10,
      pointsExpiredImmediately: 6,
    });
    expect(
      (
        repo.movements.find(
          (item) => item.id === result.movement.id,
        ) as LoyaltyMovement & { redemptionValueCents?: bigint }
      )?.redemptionValueCents,
    ).toBe(8n);
    expect(await loyalty.balance(customerId)).toMatchObject({
      availablePoints: 4,
      debtPoints: 0,
    });
    const count = repo.movements.length;
    await expect(
      loyalty.reverseRedemption({
        customerId,
        sourceType: "SALE_REDEMPTION_REVERSAL",
        sourceId: "cancel-redemption-1",
        movementId: redemption.id,
      }),
    ).resolves.toMatchObject({
      pointsRestored: 10,
      pointsExpiredImmediately: 6,
    });
    expect(repo.movements).toHaveLength(count);
  });
});
