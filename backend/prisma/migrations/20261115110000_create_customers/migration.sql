CREATE TYPE "CustomerStatus" AS ENUM ('PENDING_PIN', 'ACTIVE');

CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PENDING_PIN',
    "privacy_notice_acknowledged_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE INDEX "customers_status_name_idx" ON "customers"("status", "name");
CREATE INDEX "customers_created_by_id_idx" ON "customers"("created_by_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
