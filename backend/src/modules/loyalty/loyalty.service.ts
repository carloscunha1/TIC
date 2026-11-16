import { randomUUID } from "node:crypto";
import {
  LoyaltyAllocationType,
  LoyaltyMovementType,
  Prisma,
} from "@prisma/client";
import { ApiError } from "../../shared/http/api-error.js";
import type {
  LoyaltyRepository,
  LoyaltyUnitOfWork,
  CreditLedgerState,
} from "./loyalty.repository.js";
import {
  awardPointsSchema,
  redeemPointsSchema,
  reverseAwardSchema,
  reverseRedemptionSchema,
  type AwardPointsInput,
  type RedeemPointsInput,
  type ReverseAwardInput,
  type ReverseRedemptionInput,
} from "./loyalty.schemas.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POINTS = 2_147_483_647;
const ALLOCATION_COMPENSATE = "COMPENSATE" as unknown as LoyaltyAllocationType;
type LoyaltyServiceOptions = { now?: () => Date };
type CreditSlice = { credit: CreditLedgerState; points: number };

export class LoyaltyService {
  private readonly now: () => Date;
  constructor(
    private readonly repository: LoyaltyRepository,
    options: LoyaltyServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async balance(customerId: string, transaction?: Prisma.TransactionClient) {
    const now = this.now();
    return this.repository.transaction(transaction, async (unit) => {
      const customer = await unit.lockCustomer(customerId);
      if (!customer) throw customerNotFound();
      const effective = await effectiveBalance(unit, customerId, now);
      return {
        availablePoints: Math.max(effective, 0),
        debtPoints: Math.max(-effective, 0),
      };
    });
  }

  async award(input: AwardPointsInput, transaction?: Prisma.TransactionClient) {
    const data = awardPointsSchema.parse(input);
    const amount = new Prisma.Decimal(data.eligibleAmount).toDecimalPlaces(2);
    const now = this.now();
    try {
      return await this.repository.transaction(transaction, async (unit) => {
        const customer = await unit.lockCustomer(data.customerId);
        if (!customer) throw customerNotFound();
        const existing = await unit.creditBySource(
          data.sourceType,
          data.sourceId,
        );
        if (existing) {
          if (
            existing.customerId !== data.customerId ||
            !new Prisma.Decimal(existing.eligibleAmount).equals(amount)
          )
            throw idempotencyConflict();
          return awardResult(existing, compensatedPoints(existing));
        }
        ensureActive(customer.status);
        const policy = await unit.currentPolicy();
        if (!policy) throw policyNotInitialized();
        const pointAmount = amount.floor().mul(policy.pointsPerRealSpent);
        if (!pointAmount.isInteger() || pointAmount.gt(MAX_POINTS))
          throw new ApiError(
            422,
            "LOYALTY_POINTS_OUT_OF_RANGE",
            "O valor da compra excede o limite de pontos permitido.",
          );
        const pointsGranted = pointAmount.toNumber();
        const credit = await unit.createCredit({
          id: randomUUID(),
          customerId: data.customerId,
          policyId: policy.id,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          eligibleAmount: amount,
          pointsGranted,
          pointsPerRealSpent: policy.pointsPerRealSpent,
          redemptionPointsPerReal: policy.redemptionPointsPerReal,
          expiresAt: new Date(now.getTime() + 90 * DAY_MS),
        });
        if (pointsGranted === 0)
          return {
            credit,
            pointsGranted: 0,
            pointsCompensated: 0,
            pointsAvailable: 0,
          };

        const currentBalance = await effectiveBalance(
          unit,
          data.customerId,
          now,
        );
        const pointsCompensated = Math.min(
          pointsGranted,
          Math.max(0, -currentBalance),
        );
        const pointsAvailable = pointsGranted - pointsCompensated;
        if (pointsCompensated > 0) {
          const compensation = await unit.createMovement({
            id: randomUUID(),
            customerId: data.customerId,
            type: LoyaltyMovementType.COMPENSATION,
            pointsDelta: pointsCompensated,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            reason: "Crédito aplicado à compensação de saldo negativo.",
            actorUserId: data.actorUserId ?? null,
          });
          await unit.createAllocation({
            id: randomUUID(),
            movementId: compensation.id,
            creditId: credit.id,
            customerId: data.customerId,
            type: ALLOCATION_COMPENSATE,
            points: pointsCompensated,
          });
        }
        if (pointsAvailable > 0) {
          await unit.createMovement({
            id: randomUUID(),
            customerId: data.customerId,
            type: LoyaltyMovementType.CREDIT,
            pointsDelta: pointsAvailable,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            creditId: credit.id,
            actorUserId: data.actorUserId ?? null,
          });
        }
        return { credit, pointsGranted, pointsCompensated, pointsAvailable };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw idempotencyConflict();
      throw error;
    }
  }

  async redeem(
    input: RedeemPointsInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const data = redeemPointsSchema.parse(input);
    const now = this.now();
    try {
      return await this.repository.transaction(transaction, async (unit) => {
        const customer = await unit.lockCustomer(data.customerId);
        if (!customer) throw customerNotFound();
        const existing = await unit.movementBySource(
          data.sourceType,
          data.sourceId,
          LoyaltyMovementType.REDEMPTION,
        );
        if (existing) {
          if (
            existing.customerId !== data.customerId ||
            existing.pointsDelta !== -data.points
          )
            throw idempotencyConflict();
          const redemptionValueCents = redemptionValue(
            existing.allocations.map((allocation) => ({
              credit: allocation.credit as CreditLedgerState,
              points: allocation.points,
            })),
          );
          return {
            movement: existing,
            pointsRedeemed: data.points,
            redemptionValueCents,
          };
        }
        ensureActive(customer.status);
        const balance = await effectiveBalance(unit, data.customerId, now);
        if (balance < 0)
          throw new ApiError(
            409,
            "LOYALTY_NEGATIVE_BALANCE",
            "O cliente possui saldo negativo e não pode resgatar pontos.",
          );
        const credits = (await unit.creditsForCustomer(data.customerId)).filter(
          (credit) =>
            credit.expiresAt > now && availableCreditPoints(credit) > 0,
        );
        const slices = consumeCredits(credits, data.points);
        if (!slices)
          throw new ApiError(
            409,
            "INSUFFICIENT_LOYALTY_POINTS",
            "Saldo de pontos insuficiente para este resgate.",
          );
        const redemptionValueCents = redemptionValue(slices);
        if (redemptionValueCents <= 0n)
          throw new ApiError(
            422,
            "REDEMPTION_BELOW_ONE_CENT",
            "A quantidade de pontos deve representar pelo menos um centavo.",
          );
        const movement = await unit.createMovement({
          id: randomUUID(),
          customerId: data.customerId,
          type: LoyaltyMovementType.REDEMPTION,
          pointsDelta: -data.points,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          redemptionValueCents,
          actorUserId: data.actorUserId ?? null,
        });
        for (const slice of slices)
          await unit.createAllocation({
            id: randomUUID(),
            movementId: movement.id,
            creditId: slice.credit.id,
            customerId: data.customerId,
            type: LoyaltyAllocationType.CONSUME,
            points: slice.points,
          });
        return { movement, pointsRedeemed: data.points, redemptionValueCents };
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw idempotencyConflict();
      throw error;
    }
  }

  async reverseAward(
    input: ReverseAwardInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const data = reverseAwardSchema.parse(input);
    const now = this.now();
    const reason = `CREDIT_REVERSAL:${data.creditId}:${data.points ?? "ALL"}`;
    return this.repository.transaction(transaction, async (unit) => {
      const customer = await unit.lockCustomer(data.customerId);
      if (!customer) throw customerNotFound();
      const duplicate = await unit.movementBySource(
        data.sourceType,
        data.sourceId,
        LoyaltyMovementType.REVERSAL,
      );
      if (duplicate) {
        if (
          duplicate.customerId !== data.customerId ||
          duplicate.reason !== reason ||
          duplicate.reversalOfCreditId !== data.creditId
        )
          throw idempotencyConflict();
        return {
          movement: duplicate,
          pointsReversed: -duplicate.pointsDelta,
          pointsDebtCreated: Math.max(
            0,
            -duplicate.pointsDelta -
              duplicate.allocations
                .filter(
                  (allocation) =>
                    allocation.type === LoyaltyAllocationType.REVERSE,
                )
                .reduce((sum, allocation) => sum + allocation.points, 0),
          ),
        };
      }
      let credit = await unit.creditById(data.creditId);
      if (!credit || credit.customerId !== data.customerId)
        throw new ApiError(
          404,
          "LOYALTY_CREDIT_NOT_FOUND",
          "Crédito de pontos não encontrado.",
        );
      await expireCreditInUnit(unit, data.customerId, credit.id, now);
      credit = await unit.creditById(data.creditId);
      if (!credit)
        throw new ApiError(
          404,
          "LOYALTY_CREDIT_NOT_FOUND",
          "Crédito de pontos não encontrado.",
        );
      const original =
        (await unit.movementBySource(
          credit.sourceType,
          credit.sourceId,
          LoyaltyMovementType.CREDIT,
        )) ??
        (await unit.movementBySource(
          credit.sourceType,
          credit.sourceId,
          LoyaltyMovementType.COMPENSATION,
        ));
      if (!original)
        return { movement: null, pointsReversed: 0, pointsDebtCreated: 0 };
      const expiredPoints = expiredCreditPoints(credit);
      const priorReversed = (await unit.reversalsOfCredit(credit.id)).reduce(
        (sum, movement) => sum + Math.max(0, -movement.pointsDelta),
        0,
      );
      const reversible = Math.max(
        0,
        credit.pointsGranted - expiredPoints - priorReversed,
      );
      const requested = data.points ?? credit.pointsGranted;
      if (requested > credit.pointsGranted)
        throw new ApiError(
          409,
          "LOYALTY_CREDIT_ALREADY_REVERSED",
          "A quantidade solicitada excede os pontos deste crédito.",
        );
      const pointsReversed = Math.min(requested, reversible);
      const available = Math.min(pointsReversed, availableCreditPoints(credit));
      const movement = await unit.createMovement({
        id: randomUUID(),
        customerId: data.customerId,
        type: LoyaltyMovementType.REVERSAL,
        pointsDelta: -pointsReversed,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        reversalOfId: original.id,
        reversalOfCreditId: credit.id,
        reason,
        actorUserId: data.actorUserId ?? null,
      });
      if (available > 0)
        await unit.createAllocation({
          id: randomUUID(),
          movementId: movement.id,
          creditId: credit.id,
          customerId: data.customerId,
          type: LoyaltyAllocationType.REVERSE,
          points: available,
        });
      return {
        movement,
        pointsReversed,
        pointsDebtCreated: pointsReversed - available,
      };
    });
  }

  async reverseRedemption(
    input: ReverseRedemptionInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const data = reverseRedemptionSchema.parse(input);
    const now = this.now();
    const reason = `REDEMPTION_REVERSAL:${data.movementId}:${data.points ?? "ALL"}`;
    return this.repository.transaction(transaction, async (unit) => {
      const customer = await unit.lockCustomer(data.customerId);
      if (!customer) throw customerNotFound();
      const duplicate = await unit.movementBySource(
        data.sourceType,
        data.sourceId,
        LoyaltyMovementType.REVERSAL,
      );
      if (duplicate) {
        if (
          duplicate.customerId !== data.customerId ||
          duplicate.reversalOfId !== data.movementId ||
          duplicate.reason !== reason
        )
          throw idempotencyConflict();
        const expiration = await unit.movementBySource(
          "REDEMPTION_RETURN_EXPIRATION",
          data.sourceId,
          LoyaltyMovementType.EXPIRATION,
        );
        return {
          movement: duplicate,
          pointsRestored: duplicate.pointsDelta,
          pointsExpiredImmediately: -(expiration?.pointsDelta ?? 0),
        };
      }
      const original = await unit.movementById(data.movementId);
      if (
        !original ||
        original.customerId !== data.customerId ||
        original.type !== LoyaltyMovementType.REDEMPTION
      )
        throw new ApiError(
          404,
          "LOYALTY_REDEMPTION_NOT_FOUND",
          "Resgate de pontos não encontrado.",
        );
      for (const allocation of original.allocations)
        if (allocation.credit.expiresAt <= now)
          await expireCreditInUnit(
            unit,
            data.customerId,
            allocation.creditId,
            now,
          );
      const previousReversals = await unit.reversalsOfMovement(original.id);
      const previousByCredit = new Map<string, number>();
      for (const reversal of previousReversals)
        for (const allocation of reversal.allocations)
          if (allocation.type === LoyaltyAllocationType.RESTORE)
            previousByCredit.set(
              allocation.creditId,
              (previousByCredit.get(allocation.creditId) ?? 0) +
                allocation.points,
            );
      const remainingByCredit = original.allocations.map((allocation) => ({
        allocation,
        remaining:
          allocation.points - (previousByCredit.get(allocation.creditId) ?? 0),
      }));
      const remainingTotal = remainingByCredit.reduce(
        (sum, item) => sum + item.remaining,
        0,
      );
      const requested = data.points ?? remainingTotal;
      if (requested > remainingTotal)
        throw new ApiError(
          409,
          "LOYALTY_REDEMPTION_ALREADY_REVERSED",
          "A quantidade solicitada excede os pontos ainda disponíveis para estorno.",
        );
      const slices: CreditSlice[] = [];
      let pending = requested;
      for (const item of remainingByCredit) {
        if (pending <= 0) break;
        const amount = Math.min(item.remaining, pending);
        if (amount > 0)
          slices.push({
            credit: item.allocation.credit as CreditLedgerState,
            points: amount,
          });
        pending -= amount;
      }
      const expiredSlices = slices.filter(
        (slice) => slice.credit.expiresAt <= now,
      );
      const pointsExpiredImmediately = expiredSlices.reduce(
        (sum, slice) => sum + slice.points,
        0,
      );
      const valueCents = redemptionValue(slices);
      const movement = await unit.createMovement({
        id: randomUUID(),
        customerId: data.customerId,
        type: LoyaltyMovementType.REVERSAL,
        pointsDelta: requested,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        reversalOfId: original.id,
        redemptionValueCents: valueCents,
        reason,
        actorUserId: data.actorUserId ?? null,
      });
      for (const slice of slices)
        await unit.createAllocation({
          id: randomUUID(),
          movementId: movement.id,
          creditId: slice.credit.id,
          customerId: data.customerId,
          type: LoyaltyAllocationType.RESTORE,
          points: slice.points,
        });
      if (pointsExpiredImmediately > 0) {
        const expiration = await unit.createMovement({
          id: randomUUID(),
          customerId: data.customerId,
          type: LoyaltyMovementType.EXPIRATION,
          pointsDelta: -pointsExpiredImmediately,
          sourceType: "REDEMPTION_RETURN_EXPIRATION",
          sourceId: data.sourceId,
          reason: "Pontos estornados após a validade original.",
          actorUserId: data.actorUserId ?? null,
        });
        for (const slice of expiredSlices)
          await unit.createAllocation({
            id: randomUUID(),
            movementId: expiration.id,
            creditId: slice.credit.id,
            customerId: data.customerId,
            type: LoyaltyAllocationType.CONSUME,
            points: slice.points,
          });
      }
      return { movement, pointsRestored: requested, pointsExpiredImmediately };
    });
  }

  async expireDueCredits(now = this.now()) {
    const due = await this.repository.transaction(undefined, (unit) =>
      unit.dueCredits(now),
    );
    let creditsExpired = 0;
    let pointsExpired = 0;
    for (const candidate of due) {
      const result = await this.repository.transaction(
        undefined,
        async (unit) => {
          const customer = await unit.lockCustomer(candidate.customerId);
          if (!customer) return 0;
          return expireCreditInUnit(
            unit,
            candidate.customerId,
            candidate.id,
            now,
          );
        },
      );
      if (result > 0) {
        creditsExpired += 1;
        pointsExpired += result;
      }
    }
    return { creditsExpired, pointsExpired };
  }
}

function availableCreditPoints(credit: CreditLedgerState): number {
  const used = credit.allocations.reduce(
    (sum, allocation) =>
      sum +
      (allocation.type === LoyaltyAllocationType.RESTORE
        ? -allocation.points
        : allocation.points),
    0,
  );
  return Math.max(0, credit.pointsGranted - used);
}

async function effectiveBalance(
  unit: LoyaltyUnitOfWork,
  customerId: string,
  now: Date,
): Promise<number> {
  const movementsBalance = await unit.balance(customerId);
  const dueCredits = await unit.creditsForCustomer(customerId);
  const expiredButUnrecorded = dueCredits
    .filter((credit) => credit.expiresAt <= now)
    .reduce((sum, credit) => sum + availableCreditPoints(credit), 0);
  return movementsBalance - expiredButUnrecorded;
}

async function expireCreditInUnit(
  unit: LoyaltyUnitOfWork,
  customerId: string,
  creditId: string,
  now: Date,
): Promise<number> {
  const credit = await unit.creditById(creditId);
  if (!credit || credit.customerId !== customerId || credit.expiresAt > now)
    return 0;
  const alreadyExpired = await unit.movementBySource(
    "CREDIT_EXPIRATION",
    credit.id,
    LoyaltyMovementType.EXPIRATION,
  );
  if (alreadyExpired) return 0;
  const amount = availableCreditPoints(credit);
  if (amount <= 0) return 0;
  const movement = await unit.createMovement({
    id: randomUUID(),
    customerId,
    type: LoyaltyMovementType.EXPIRATION,
    pointsDelta: -amount,
    sourceType: "CREDIT_EXPIRATION",
    sourceId: credit.id,
    reason: "Crédito vencido após 90 dias.",
    actorUserId: null,
  });
  await unit.createAllocation({
    id: randomUUID(),
    movementId: movement.id,
    creditId: credit.id,
    customerId,
    type: LoyaltyAllocationType.CONSUME,
    points: amount,
  });
  return amount;
}

function expiredCreditPoints(credit: CreditLedgerState): number {
  return credit.allocations.reduce(
    (sum, allocation) =>
      sum +
      (allocation.type === LoyaltyAllocationType.CONSUME &&
      allocation.movement.type === LoyaltyMovementType.EXPIRATION
        ? allocation.points
        : 0),
    0,
  );
}

function compensatedPoints(credit: CreditLedgerState): number {
  return credit.allocations.reduce(
    (sum, allocation) =>
      sum + (allocation.type === ALLOCATION_COMPENSATE ? allocation.points : 0),
    0,
  );
}

function consumeCredits(
  credits: CreditLedgerState[],
  requested: number,
): CreditSlice[] | null {
  const slices: CreditSlice[] = [];
  let pending = requested;
  for (const credit of credits) {
    if (pending <= 0) break;
    const amount = Math.min(availableCreditPoints(credit), pending);
    if (amount > 0) slices.push({ credit, points: amount });
    pending -= amount;
  }
  return pending === 0 ? slices : null;
}

function redemptionValue(slices: CreditSlice[]): bigint {
  let numerator = 0n;
  let denominator = 1n;
  for (const slice of slices) {
    const rate = BigInt(slice.credit.redemptionPointsPerReal);
    numerator = numerator * rate + BigInt(slice.points) * 100n * denominator;
    denominator *= rate;
    const divisor = greatestCommonDivisor(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
  }
  return numerator / denominator;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function ensureActive(status: string) {
  if (status !== "ACTIVE")
    throw new ApiError(
      409,
      "CUSTOMER_INACTIVE",
      "Cliente inativo não pode movimentar pontos.",
    );
}
function customerNotFound() {
  return new ApiError(404, "CUSTOMER_NOT_FOUND", "Cliente não encontrado.");
}
function policyNotInitialized() {
  return new ApiError(
    503,
    "LOYALTY_POLICY_NOT_INITIALIZED",
    "A política de fidelidade ainda não foi inicializada.",
  );
}
function idempotencyConflict() {
  return new ApiError(
    409,
    "LOYALTY_IDEMPOTENCY_CONFLICT",
    "A chave de idempotência já foi usada com dados diferentes.",
  );
}
function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
function awardResult(credit: CreditLedgerState, compensated: number) {
  return {
    credit,
    pointsGranted: credit.pointsGranted,
    pointsCompensated: compensated,
    pointsAvailable: credit.pointsGranted - compensated,
  };
}
