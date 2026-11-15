CREATE TABLE "stock_loss_reasons" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "stock_loss_reasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_loss_reasons_name_key" ON "stock_loss_reasons"("name");
CREATE INDEX "stock_loss_reasons_is_active_name_idx" ON "stock_loss_reasons"("is_active", "name");
ALTER TABLE "stock_loss_reasons" ADD CONSTRAINT "stock_loss_reasons_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD COLUMN "stock_loss_reason_id" UUID;
CREATE INDEX "stock_movements_stock_loss_reason_id_idx" ON "stock_movements"("stock_loss_reason_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_loss_reason_id_fkey"
  FOREIGN KEY ("stock_loss_reason_id") REFERENCES "stock_loss_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
