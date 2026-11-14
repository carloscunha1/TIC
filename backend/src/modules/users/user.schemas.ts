import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
