CREATE TYPE "SaleReturnStatus" AS ENUM ('CONFIRMADA', 'CANCELADA');
CREATE TYPE "SaleReturnDestination" AS ENUM ('COMERCIALIZAVEL', 'PERDA');

CREATE TABLE "sale_returns" (
  "id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "status" "SaleReturnStatus" NOT NULL DEFAULT 'CONFIRMADA',
  "idempotency_key" VARCHAR(100) NOT NULL,
  "idempotency_fingerprint" VARCHAR(64) NOT NULL,
  "refund_amount" DECIMAL(12,2) NOT NULL,
  "refund_payment_method" "SalePaymentMethod",
  "operator_user_id" UUID NOT NULL,
  "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancellation_justification" VARCHAR(500),
  "canceled_by_user_id" UUID,
  "canceled_at" TIMESTAMPTZ(3),
  CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_return_items" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "sale_item_id" UUID NOT NULL,
  "lot_id" UUID,
  "quantity" DECIMAL(12,3) NOT NULL,
  "destination" "SaleReturnDestination" NOT NULL,
  CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sale_returns_idempotency_key_key" ON "sale_returns"("idempotency_key");
CREATE INDEX "sale_returns_sale_id_status_confirmed_at_idx" ON "sale_returns"("sale_id", "status", "confirmed_at");
CREATE INDEX "sale_returns_operator_user_id_idx" ON "sale_returns"("operator_user_id");
CREATE INDEX "sale_returns_canceled_by_user_id_idx" ON "sale_returns"("canceled_by_user_id");
CREATE INDEX "sale_return_items_return_id_idx" ON "sale_return_items"("return_id");
CREATE INDEX "sale_return_items_sale_item_id_lot_id_idx" ON "sale_return_items"("sale_item_id", "lot_id");
CREATE INDEX "sale_return_items_lot_id_idx" ON "sale_return_items"("lot_id");

ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_canceled_by_user_id_fkey" FOREIGN KEY ("canceled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
