import { z } from 'zod';

export const predefinedLossReasons = [
  { id: 'EXPIRED', name: 'Vencido' },
  { id: 'DAMAGED', name: 'Danificado' },
  { id: 'BROKEN', name: 'Quebrado' },
  { id: 'MISSING', name: 'Extraviado' },
  { id: 'OPERATIONAL_DISPOSAL', name: 'Descarte operacional' },
  { id: 'OTHER', name: 'Outros' },
] as const;

export const stockLossSchema = z.object({
  productId: z.string().uuid(),
  reasonId: z.union([z.enum(['EXPIRED', 'DAMAGED', 'BROKEN', 'MISSING', 'OPERATIONAL_DISPOSAL', 'OTHER']), z.string().uuid()]),
  quantity: z.number().finite().positive().max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
  lotId: z.string().uuid().optional(),
  observations: z.string().trim().max(500).optional(),
});

export const customStockLossReasonSchema = z.object({ name: z.string().trim().min(2).max(120) });
export const updateCustomStockLossReasonSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional() }).refine((value) => value.name !== undefined || value.isActive !== undefined);
export type StockLossInput = z.infer<typeof stockLossSchema>;
