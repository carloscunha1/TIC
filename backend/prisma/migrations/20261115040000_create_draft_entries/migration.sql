CREATE TYPE "EntryStatus" AS ENUM ('EM_ANDAMENTO', 'CONFIRMADA', 'CANCELADA');

CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "supplier_id" UUID,
    "created_by_id" UUID NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entry_items" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "lot_identifier" VARCHAR(120),
    "expiration_date" DATE,
    CONSTRAINT "entry_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entry_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "entry_items_unit_cost_nonnegative" CHECK ("unit_cost" >= 0)
);

CREATE INDEX "entries_status_created_at_idx" ON "entries"("status", "created_at");
CREATE INDEX "entries_supplier_id_idx" ON "entries"("supplier_id");
CREATE INDEX "entry_items_entry_id_idx" ON "entry_items"("entry_id");
CREATE INDEX "entry_items_product_id_idx" ON "entry_items"("product_id");

ALTER TABLE "entries" ADD CONSTRAINT "entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entries" ADD CONSTRAINT "entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entry_items" ADD CONSTRAINT "entry_items_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entry_items" ADD CONSTRAINT "entry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
