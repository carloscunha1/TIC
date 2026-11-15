import { z } from 'zod';

export const inventoryTypeSchema = z.enum(['COMPLETE', 'PARTIAL']);
export const createInventorySchema = z.object({
  type: inventoryTypeSchema,
  productIds: z.array(z.string().uuid()).max(500).default([]),
  categoryIds: z.array(z.string().uuid()).max(100).default([]),
  observations: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.type === 'PARTIAL' && !value.productIds.length && !value.categoryIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione ao menos um produto ou categoria para o inventário parcial.', path: ['productIds'] });
  }
  if (value.type === 'COMPLETE' && (value.productIds.length || value.categoryIds.length)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Inventário completo não aceita filtros de seleção.', path: ['type'] });
  }
  if (new Set(value.productIds).size !== value.productIds.length || new Set(value.categoryIds).size !== value.categoryIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A seleção contém itens duplicados.' });
  }
});

export const recordInventoryCountSchema = z.object({
  countedQuantity: z.number().finite().min(0).max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
});
export const inventoryIdParamsSchema = z.object({ id: z.string().uuid() });
export const inventoryItemParamsSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
export const inventoryListQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
