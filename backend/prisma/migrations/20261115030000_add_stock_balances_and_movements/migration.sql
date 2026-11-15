CREATE TYPE "StockMovementType" AS ENUM (
    'ENTRY',
    'EXIT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'LOSS',
    'RETURN_IN',
    'RETURN_OUT',
    'REVERSAL_IN',
    'REVERSAL_OUT'
);

CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_balances_quantity_nonnegative" CHECK ("quantity" >= 0)
);

CREATE UNIQUE INDEX "stock_balances_product_id_key" ON "stock_balances"("product_id");

INSERT INTO "stock_balances" ("id", "product_id", "quantity", "updated_at")
SELECT gen_random_uuid(), "id", 0, CURRENT_TIMESTAMP
FROM "products"
WHERE "stock_mode" = 'SIMPLES';

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "observations" VARCHAR(500),
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");
CREATE INDEX "stock_movements_actor_user_id_idx" ON "stock_movements"("actor_user_id");

ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
