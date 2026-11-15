import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const categoryIdParamSchema = z.object({ id: z.string().uuid() });
export const updateCategorySchema = createCategorySchema;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
