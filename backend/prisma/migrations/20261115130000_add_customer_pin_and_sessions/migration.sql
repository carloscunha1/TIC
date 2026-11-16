ALTER TABLE "customers"
    ADD COLUMN "pin_hash" VARCHAR(255),
    ADD COLUMN "pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "pin_locked_until" TIMESTAMPTZ(3),
    ADD COLUMN "pin_setup_token_hash" VARCHAR(64),
    ADD COLUMN "pin_setup_token_expires_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "customers_pin_setup_token_hash_key" ON "customers"("pin_setup_token_hash");

CREATE TABLE "customer_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_sessions_token_hash_key" ON "customer_sessions"("token_hash");
CREATE INDEX "customer_sessions_customer_id_revoked_at_idx" ON "customer_sessions"("customer_id", "revoked_at");
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
