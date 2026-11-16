CREATE TYPE "LoyaltyMovementType" AS ENUM ('CREDIT', 'REDEMPTION', 'EXPIRATION', 'REVERSAL', 'COMPENSATION');
CREATE TYPE "LoyaltyAllocationType" AS ENUM ('CONSUME', 'RESTORE', 'REVERSE');

CREATE TABLE "loyalty_policies" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "points_per_real_spent" INTEGER NOT NULL,
    "redemption_points_per_real" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_policies_points_per_real_spent_check" CHECK ("points_per_real_spent" > 0),
    CONSTRAINT "loyalty_policies_redemption_points_per_real_check" CHECK ("redemption_points_per_real" > 0)
);
CREATE UNIQUE INDEX "loyalty_policies_version_key" ON "loyalty_policies"("version");
CREATE UNIQUE INDEX "loyalty_policies_one_active_idx" ON "loyalty_policies" ("is_active") WHERE "is_active" = true;
CREATE INDEX "loyalty_policies_is_active_version_idx" ON "loyalty_policies"("is_active", "version");
CREATE INDEX "loyalty_policies_created_by_user_id_created_at_idx" ON "loyalty_policies"("created_by_user_id", "created_at");
ALTER TABLE "loyalty_policies" ADD CONSTRAINT "loyalty_policies_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "loyalty_policies" ("id", "version", "points_per_real_spent", "redemption_points_per_real", "is_active")
VALUES (gen_random_uuid(), 1, 1, 100, true);

CREATE TABLE "loyalty_credits" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "source_id" VARCHAR(100) NOT NULL,
    "eligible_amount" DECIMAL(12,2) NOT NULL,
    "points_granted" INTEGER NOT NULL,
    "points_per_real_spent" INTEGER NOT NULL,
    "redemption_points_per_real" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_credits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_credits_eligible_amount_check" CHECK ("eligible_amount" > 0),
    CONSTRAINT "loyalty_credits_points_granted_check" CHECK ("points_granted" > 0),
    CONSTRAINT "loyalty_credits_snapshot_rates_check" CHECK ("points_per_real_spent" > 0 AND "redemption_points_per_real" > 0)
);
CREATE UNIQUE INDEX "loyalty_credits_source_type_source_id_key" ON "loyalty_credits"("source_type", "source_id");
CREATE UNIQUE INDEX "loyalty_credits_id_customer_id_key" ON "loyalty_credits"("id", "customer_id");
CREATE INDEX "loyalty_credits_customer_id_expires_at_created_at_idx" ON "loyalty_credits"("customer_id", "expires_at", "created_at");
CREATE INDEX "loyalty_credits_policy_id_idx" ON "loyalty_credits"("policy_id");
ALTER TABLE "loyalty_credits" ADD CONSTRAINT "loyalty_credits_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_credits" ADD CONSTRAINT "loyalty_credits_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "loyalty_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "loyalty_movements" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "LoyaltyMovementType" NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "source_id" VARCHAR(100),
    "reason" VARCHAR(300),
    "credit_id" UUID,
    "reversal_of_id" UUID,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_movements_points_delta_check" CHECK (
      ("type" IN ('CREDIT', 'COMPENSATION') AND "points_delta" > 0)
      OR ("type" IN ('REDEMPTION', 'EXPIRATION') AND "points_delta" < 0)
      OR ("type" = 'REVERSAL' AND "points_delta" <> 0)
    ),
    CONSTRAINT "loyalty_movements_credit_relation_check" CHECK (("type" = 'CREDIT') = ("credit_id" IS NOT NULL)),
    CONSTRAINT "loyalty_movements_reversal_relation_check" CHECK ("type" <> 'REVERSAL' OR "reversal_of_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "loyalty_movements_credit_id_key" ON "loyalty_movements"("credit_id");
CREATE UNIQUE INDEX "loyalty_movements_id_customer_id_key" ON "loyalty_movements"("id", "customer_id");
CREATE UNIQUE INDEX "loyalty_movements_source_type_source_id_type_key" ON "loyalty_movements"("source_type", "source_id", "type");
CREATE INDEX "loyalty_movements_customer_id_created_at_idx" ON "loyalty_movements"("customer_id", "created_at");
CREATE INDEX "loyalty_movements_type_created_at_idx" ON "loyalty_movements"("type", "created_at");
CREATE INDEX "loyalty_movements_reversal_of_id_idx" ON "loyalty_movements"("reversal_of_id");
CREATE INDEX "loyalty_movements_actor_user_id_idx" ON "loyalty_movements"("actor_user_id");
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_credit_id_fkey"
    FOREIGN KEY ("credit_id") REFERENCES "loyalty_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_reversal_of_id_fkey"
    FOREIGN KEY ("reversal_of_id") REFERENCES "loyalty_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_credit_id_customer_id_fkey"
    FOREIGN KEY ("credit_id", "customer_id") REFERENCES "loyalty_credits"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_reversal_of_id_customer_id_fkey"
    FOREIGN KEY ("reversal_of_id", "customer_id") REFERENCES "loyalty_movements"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "loyalty_allocations" (
    "id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "credit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "LoyaltyAllocationType" NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_allocations_points_check" CHECK ("points" > 0)
);
CREATE UNIQUE INDEX "loyalty_allocations_movement_id_credit_id_type_key" ON "loyalty_allocations"("movement_id", "credit_id", "type");
CREATE INDEX "loyalty_allocations_credit_id_created_at_idx" ON "loyalty_allocations"("credit_id", "created_at");
ALTER TABLE "loyalty_allocations" ADD CONSTRAINT "loyalty_allocations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_allocations" ADD CONSTRAINT "loyalty_allocations_movement_id_fkey"
    FOREIGN KEY ("movement_id") REFERENCES "loyalty_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_allocations" ADD CONSTRAINT "loyalty_allocations_credit_id_fkey"
    FOREIGN KEY ("credit_id") REFERENCES "loyalty_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_allocations" ADD CONSTRAINT "loyalty_allocations_movement_id_customer_id_fkey"
    FOREIGN KEY ("movement_id", "customer_id") REFERENCES "loyalty_movements"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_allocations" ADD CONSTRAINT "loyalty_allocations_credit_id_customer_id_fkey"
    FOREIGN KEY ("credit_id", "customer_id") REFERENCES "loyalty_credits"("id", "customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_loyalty_ledger_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Loyalty ledger records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "loyalty_credits_immutable"
    BEFORE UPDATE OR DELETE ON "loyalty_credits"
    FOR EACH ROW EXECUTE FUNCTION "reject_loyalty_ledger_mutation"();
CREATE TRIGGER "loyalty_movements_immutable"
    BEFORE UPDATE OR DELETE ON "loyalty_movements"
    FOR EACH ROW EXECUTE FUNCTION "reject_loyalty_ledger_mutation"();
CREATE TRIGGER "loyalty_allocations_immutable"
    BEFORE UPDATE OR DELETE ON "loyalty_allocations"
    FOR EACH ROW EXECUTE FUNCTION "reject_loyalty_ledger_mutation"();

CREATE FUNCTION "protect_loyalty_policy_history"() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Loyalty policy history is immutable';
    END IF;
    IF OLD.is_active = false
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.points_per_real_spent IS DISTINCT FROM OLD.points_per_real_spent
       OR NEW.redemption_points_per_real IS DISTINCT FROM OLD.redemption_points_per_real
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.is_active IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'Only the active loyalty policy can be deactivated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "loyalty_policies_immutable_history"
    BEFORE UPDATE OR DELETE ON "loyalty_policies"
    FOR EACH ROW EXECUTE FUNCTION "protect_loyalty_policy_history"();
