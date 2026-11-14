import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
