import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  phone: z.string().trim().min(1, 'Informe o telefone do cliente.').max(20),
  privacyNoticeAcknowledged: z.literal(true, { errorMap: () => ({ message: 'Confirme a ciência do aviso de privacidade.' }) }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
