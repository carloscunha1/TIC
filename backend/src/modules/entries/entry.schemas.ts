import { z } from 'zod';

const entryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().finite().positive().max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
  unitCost: z.number().finite().min(0).max(9_999_999_999.99).refine((value) => Number(value.toFixed(2)) === value, 'Custo unitário aceita até 2 casas decimais.'),
  lotIdentifier: z.string().trim().min(1).max(120).optional(),
  expirationDate: z.string().date().optional(),
});

export const entryDraftSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  items: z.array(entryItemSchema).min(1).max(100),
});

export const entryIdParamSchema = z.object({ id: z.string().uuid() });
export const entryListQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
export type EntryDraftInput = z.infer<typeof entryDraftSchema>;
