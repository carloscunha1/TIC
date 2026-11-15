import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional(),
  barcode: z.string().trim().max(50).optional(),
  categoryId: z.string().uuid(),
  unit: z.enum(['UN', 'KG', 'G', 'L', 'ML']),
  cost: z.coerce.number().finite().min(0),
  salePrice: z.coerce.number().finite().min(0),
  minimumStock: z.coerce.number().finite().min(0).default(0),
  stockMode: z.enum(['SIMPLES', 'LOTE']),
  expirationAlertDays: z.coerce.number().int().min(0).max(365).default(15),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
