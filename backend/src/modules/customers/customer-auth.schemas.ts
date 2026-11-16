import { z } from 'zod';

export const startCustomerPinSetupParamsSchema = z.object({ customerId: z.string().uuid() });
export const completeCustomerPinSetupSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  pin: z.string().regex(/^\d{6}$/, 'O PIN deve conter seis dígitos.'),
});
export const customerLoginSchema = z.object({
  phone: z.string().trim().min(1).max(20),
  pin: z.string().regex(/^\d{6}$/),
});

export type CompleteCustomerPinSetupInput = z.infer<typeof completeCustomerPinSetupSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
