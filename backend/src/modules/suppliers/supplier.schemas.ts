import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  document: z.string().trim().optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
