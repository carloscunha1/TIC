import { z } from 'zod';

const quantitySchema = z.number().finite().positive().max(999_999_999.999)
  .refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.');

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantitySchema,
});

export const saleDraftSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  observations: z.string().trim().max(500).nullable().optional(),
  items: z.array(saleItemSchema).min(1).max(500),
});

export const saleUpdateSchema = saleDraftSchema.omit({ items: true });
export const saleItemInputSchema = saleItemSchema;
export const saleItemIdParamSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
export const saleIdParamSchema = z.object({ id: z.string().uuid() });
export const saleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SaleDraftInput = z.infer<typeof saleDraftSchema>;
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
