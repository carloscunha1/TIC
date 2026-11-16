import { z } from 'zod';

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(160).optional(),
  status: z.enum(['PENDING_PIN', 'ACTIVE']).optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
