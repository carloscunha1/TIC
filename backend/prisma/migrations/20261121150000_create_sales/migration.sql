CREATE TYPE "SaleStatus" AS ENUM ('EM_ANDAMENTO', 'CONFIRMADA', 'PARCIALMENTE_DEVOLVIDA', 'DEVOLVIDA', 'CANCELADA');

CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "customer_id" UUID,
    "status" "SaleStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "observations" VARCHAR(500),
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sale_items_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "sale_items_unit_price_nonnegative" CHECK ("unit_price" >= 0),
    CONSTRAINT "sale_items_total_nonnegative" CHECK ("total" >= 0)
);

CREATE INDEX "sales_status_updated_at_idx" ON "sales"("status", "updated_at");
CREATE INDEX "sales_operator_user_id_updated_at_idx" ON "sales"("operator_user_id", "updated_at");
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");
CREATE INDEX "sale_items_sale_id_created_at_idx" ON "sale_items"("sale_id", "created_at");
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

ALTER TABLE "sales" ADD CONSTRAINT "sales_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
