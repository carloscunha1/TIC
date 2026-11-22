CREATE TABLE "establishment_settings" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "cnpj" VARCHAR(14),
    "phone" VARCHAR(20),
    "address" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "establishment_settings_pkey" PRIMARY KEY ("id")
);
