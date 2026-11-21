CREATE TYPE "AlertType" AS ENUM ('ESTOQUE_ZERADO', 'ESTOQUE_ABAIXO_MINIMO', 'LOTE_PROXIMO_VENCIMENTO', 'LOTE_VENCIDO', 'SALDO_FIDELIDADE_NEGATIVO');
CREATE TYPE "AlertPriority" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');
CREATE TYPE "AlertStatus" AS ENUM ('ATIVO', 'RESOLVIDO');

CREATE TABLE "operational_alerts" (
  "id" UUID NOT NULL,
  "type" "AlertType" NOT NULL,
  "priority" "AlertPriority" NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'ATIVO',
  "event_key" VARCHAR(180) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "product_id" UUID,
  "lot_id" UUID,
  "customer_id" UUID,
  "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "operational_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_reads" (
  "id" UUID NOT NULL,
  "alert_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_reads_alert_id_user_id_key" ON "alert_reads"("alert_id", "user_id");
CREATE INDEX "operational_alerts_status_priority_detected_at_idx" ON "operational_alerts"("status", "priority", "detected_at");
CREATE INDEX "operational_alerts_event_key_status_idx" ON "operational_alerts"("event_key", "status");
CREATE INDEX "operational_alerts_product_id_status_idx" ON "operational_alerts"("product_id", "status");
CREATE INDEX "operational_alerts_lot_id_status_idx" ON "operational_alerts"("lot_id", "status");
CREATE INDEX "operational_alerts_customer_id_status_idx" ON "operational_alerts"("customer_id", "status");
CREATE INDEX "alert_reads_user_id_read_at_idx" ON "alert_reads"("user_id", "read_at");

ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alert_reads" ADD CONSTRAINT "alert_reads_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "operational_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_reads" ADD CONSTRAINT "alert_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
