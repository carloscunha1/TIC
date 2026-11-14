ALTER TABLE "users"
  ADD COLUMN "reset_token_hash" VARCHAR(64),
  ADD COLUMN "reset_token_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_reset_token_hash_key" ON "users"("reset_token_hash");
