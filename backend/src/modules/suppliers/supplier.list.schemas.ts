import { z } from 'zod';

export const listSuppliersQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), name: z.string().trim().max(160).optional(), status: z.enum(['ACTIVE', 'INACTIVE']).optional() });
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
