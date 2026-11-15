CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "document" VARCHAR(14),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "notes" VARCHAR(500),
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "suppliers_document_key" ON "suppliers"("document");
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");
