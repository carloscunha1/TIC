import { z } from 'zod';

export const stockMovementTypeSchema = z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL_IN', 'REVERSAL_OUT']);

export const recordStockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: stockMovementTypeSchema,
  quantity: z.coerce.number().finite().positive().max(999999999.999),
  reason: z.string().trim().min(1).max(300),
  observations: z.string().trim().max(500).optional(),
});

export const stockExitSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().finite().positive().max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
  reason: z.string().trim().min(1).max(300),
});

export const stockBalanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type RecordStockMovementInput = z.infer<typeof recordStockMovementSchema>;
export type StockExitInput = z.infer<typeof stockExitSchema>;
