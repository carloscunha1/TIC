import { z } from 'zod';

export const userIdParamSchema = z.object({ id: z.string().uuid() });

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
