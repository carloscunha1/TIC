CREATE TYPE "ProductValueField" AS ENUM ('SALE_PRICE', 'COST');

CREATE TABLE "product_value_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "field" "ProductValueField" NOT NULL,
    "previous_value" DECIMAL(12,2) NOT NULL,
    "new_value" DECIMAL(12,2) NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'MANUAL_EDIT',
    "source_id" VARCHAR(100),
    "changed_by_user_id" UUID,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_value_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_value_history_product_id_changed_at_idx" ON "product_value_history"("product_id", "changed_at");
CREATE INDEX "product_value_history_changed_by_user_id_idx" ON "product_value_history"("changed_by_user_id");

ALTER TABLE "product_value_history" ADD CONSTRAINT "product_value_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_value_history" ADD CONSTRAINT "product_value_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
