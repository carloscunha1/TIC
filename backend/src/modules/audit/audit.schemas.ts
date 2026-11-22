import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use datas no formato AAAA-MM-DD.');

export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  actorUserId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  entity: z.string().trim().min(1).max(100).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
