CREATE TYPE "SaleCancellationReason" AS ENUM (
    'DESISTENCIA_CLIENTE',
    'ERRO_REGISTRO',
    'PRODUTO_INDISPONIVEL',
    'VENDA_DUPLICADA',
    'OUTROS',
    'EXPIRACAO_POR_INATIVIDADE'
);

ALTER TABLE "sales"
ADD COLUMN "cancellation_reason" "SaleCancellationReason";
