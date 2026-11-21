CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT', 'CREDIT', 'OTHER', 'LOYALTY');

ALTER TABLE "sales"
  ADD COLUMN "payment_method" "SalePaymentMethod",
  ADD COLUMN "loyalty_points_redeemed" INTEGER,
  ADD COLUMN "idempotency_key" VARCHAR(100),
  ADD COLUMN "idempotency_fingerprint" VARCHAR(64),
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "sales_idempotency_key_key" ON "sales"("idempotency_key");

CREATE TABLE "sale_item_allocations" (
    "id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "sale_item_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_item_allocations_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "sale_item_allocations_sale_item_id_idx" ON "sale_item_allocations"("sale_item_id");
CREATE INDEX "sale_item_allocations_lot_id_idx" ON "sale_item_allocations"("lot_id");

ALTER TABLE "sale_item_allocations" ADD CONSTRAINT "sale_item_allocations_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item_allocations" ADD CONSTRAINT "sale_item_allocations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
