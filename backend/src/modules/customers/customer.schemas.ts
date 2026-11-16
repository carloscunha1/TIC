import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  phone: z.string().trim().min(1, 'Informe o telefone do cliente.').max(20),
  privacyNoticeAcknowledged: z.literal(true, { errorMap: () => ({ message: 'Confirme a ciência do aviso de privacidade.' }) }),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  phone: z.string().trim().min(1, 'Informe o telefone do cliente.').max(20),
});
export const customerIdParamsSchema = z.object({ id: z.string().uuid() });
export const customerStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
