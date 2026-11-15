CREATE TYPE "InventoryType" AS ENUM ('COMPLETE', 'PARTIAL');
CREATE TYPE "InventoryStatus" AS ENUM ('EM_ANDAMENTO', 'AGUARDANDO_CONFERENCIA', 'CONFIRMADO', 'CANCELADO');

CREATE TABLE "inventories" (
  "id" UUID NOT NULL,
  "type" "InventoryType" NOT NULL,
  "status" "InventoryStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
  "observations" VARCHAR(500),
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventories_status_started_at_idx" ON "inventories"("status", "started_at");
CREATE INDEX "inventories_created_by_id_idx" ON "inventories"("created_by_id");
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL,
  "inventory_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "lot_id" UUID,
  "snapshot_quantity" DECIMAL(12,3) NOT NULL,
  "counted_quantity" DECIMAL(12,3),
  "counted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inventory_items_inventory_id_product_id_lot_id_key" ON "inventory_items"("inventory_id", "product_id", "lot_id");
CREATE INDEX "inventory_items_inventory_id_product_id_idx" ON "inventory_items"("inventory_id", "product_id");
CREATE INDEX "inventory_items_lot_id_idx" ON "inventory_items"("lot_id");
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_inventory_id_fkey"
  FOREIGN KEY ("inventory_id") REFERENCES "inventories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
