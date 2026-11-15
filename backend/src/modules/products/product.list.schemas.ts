import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  stockMode: z.enum(['SIMPLES', 'LOTE']).optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
