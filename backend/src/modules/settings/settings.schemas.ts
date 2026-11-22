import { z } from 'zod';

export const establishmentSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().max(18).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
});

export type EstablishmentSettingsInput = z.infer<typeof establishmentSettingsSchema>;
