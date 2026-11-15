CREATE TYPE "ProductUnit" AS ENUM ('UN', 'KG', 'G', 'L', 'ML');
CREATE TYPE "StockMode" AS ENUM ('SIMPLES', 'LOTE');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "barcode" VARCHAR(50),
    "category_id" UUID NOT NULL,
    "unit" "ProductUnit" NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "sale_price" DECIMAL(12,2) NOT NULL,
    "minimum_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_mode" "StockMode" NOT NULL,
    "expiration_alert_days" INTEGER NOT NULL DEFAULT 15,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "products_status_idx" ON "products"("status");
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
