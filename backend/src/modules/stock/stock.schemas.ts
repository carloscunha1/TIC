import { z } from 'zod';

export const stockMovementTypeSchema = z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL_IN', 'REVERSAL_OUT']);

export const recordStockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: stockMovementTypeSchema,
  quantity: z.coerce.number().finite().positive().max(999999999.999),
  reason: z.string().trim().min(1).max(300),
  observations: z.string().trim().max(500).optional(),
});

export type RecordStockMovementInput = z.infer<typeof recordStockMovementSchema>;
