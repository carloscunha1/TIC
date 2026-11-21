ALTER TABLE "sales"
  ADD COLUMN "cancellation_justification" VARCHAR(500),
  ADD COLUMN "canceled_by_user_id" UUID,
  ADD COLUMN "canceled_at" TIMESTAMPTZ(3),
  ADD COLUMN "refund_amount" DECIMAL(12,2),
  ADD COLUMN "refund_payment_method" "SalePaymentMethod",
  ADD COLUMN "refund_operator_user_id" UUID,
  ADD COLUMN "refund_recorded_at" TIMESTAMPTZ(3);

CREATE INDEX "sales_canceled_by_user_id_idx" ON "sales"("canceled_by_user_id");
CREATE INDEX "sales_refund_operator_user_id_idx" ON "sales"("refund_operator_user_id");

ALTER TABLE "sales" ADD CONSTRAINT "sales_canceled_by_user_id_fkey" FOREIGN KEY ("canceled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_refund_operator_user_id_fkey" FOREIGN KEY ("refund_operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
