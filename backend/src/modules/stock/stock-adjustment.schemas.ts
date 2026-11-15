import { z } from 'zod';

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  direction: z.enum(['POSITIVE', 'NEGATIVE']),
  quantity: z.number().finite().positive().max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
  justification: z.string().trim().min(1).max(300),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
