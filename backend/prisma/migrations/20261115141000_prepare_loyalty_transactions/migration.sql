ALTER TYPE "LoyaltyAllocationType" ADD VALUE 'COMPENSATE';

ALTER TABLE "loyalty_credits" DROP CONSTRAINT "loyalty_credits_points_granted_check";
ALTER TABLE "loyalty_credits" ADD CONSTRAINT "loyalty_credits_points_granted_check" CHECK ("points_granted" >= 0);

ALTER TABLE "loyalty_movements" ADD COLUMN "redemption_value_cents" BIGINT;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_redemption_value_check"
    CHECK ("redemption_value_cents" IS NULL OR ("redemption_value_cents" >= 0 AND "type" IN ('REDEMPTION', 'REVERSAL')));

ALTER TABLE "loyalty_movements" DROP CONSTRAINT "loyalty_movements_points_delta_check";
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_points_delta_check" CHECK (
    ("type" IN ('CREDIT', 'COMPENSATION') AND "points_delta" > 0)
    OR ("type" IN ('REDEMPTION', 'EXPIRATION') AND "points_delta" < 0)
    OR "type" = 'REVERSAL'
);
