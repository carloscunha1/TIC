CREATE TABLE "stock_lots" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "identifier" VARCHAR(120) NOT NULL,
    "expiration_date" DATE,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "initial_quantity" DECIMAL(12,3) NOT NULL,
    "current_quantity" DECIMAL(12,3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_lots_unit_cost_nonnegative" CHECK ("unit_cost" >= 0),
    CONSTRAINT "stock_lots_initial_quantity_positive" CHECK ("initial_quantity" > 0),
    CONSTRAINT "stock_lots_current_quantity_valid" CHECK ("current_quantity" >= 0 AND "current_quantity" <= "initial_quantity")
);

ALTER TABLE "stock_movements" ADD COLUMN "lot_id" UUID;
CREATE INDEX "stock_movements_lot_id_idx" ON "stock_movements"("lot_id");
CREATE INDEX "stock_lots_product_id_expiration_date_received_at_idx" ON "stock_lots"("product_id", "expiration_date", "received_at");
CREATE INDEX "stock_lots_product_id_identifier_idx" ON "stock_lots"("product_id", "identifier");

ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entry_items" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
WITH ordered_items AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "entry_id" ORDER BY "id") - 1 AS "position"
    FROM "entry_items"
)
UPDATE "entry_items" AS item
SET "position" = ordered_items."position"
FROM ordered_items
WHERE item."id" = ordered_items."id";
DROP INDEX "entry_items_entry_id_idx";
CREATE INDEX "entry_items_entry_id_position_idx" ON "entry_items"("entry_id", "position");
