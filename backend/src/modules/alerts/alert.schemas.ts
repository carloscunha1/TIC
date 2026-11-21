import { z } from 'zod';

export const alertListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ATIVO', 'RESOLVIDO']).optional(),
  type: z.enum(['ESTOQUE_ZERADO', 'ESTOQUE_ABAIXO_MINIMO', 'LOTE_PROXIMO_VENCIMENTO', 'LOTE_VENCIDO', 'SALDO_FIDELIDADE_NEGATIVO']).optional(),
  priority: z.enum(['ALTA', 'MEDIA', 'BAIXA']).optional(),
});

export const alertIdParamSchema = z.object({ id: z.string().uuid() });

export type AlertListQuery = z.infer<typeof alertListQuerySchema>;
