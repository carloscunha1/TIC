import { ApiError } from '../../shared/http/api-error.js';
import type { CategoryRepository } from './category.repository.js';
import type { UpdateCategoryInput } from './category.schemas.js';

export class CategoryUpdateService {
  constructor(private readonly repository: CategoryRepository) {}

  async get(id: string) {
    const category = await this.repository.findById(id);
    if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    return category;
  }

  async update(id: string, input: UpdateCategoryInput, actorUserId: string, ipAddress?: string) {
    try {
      return await this.repository.update(id, { actorUserId, description: input.description?.trim() || undefined, ipAddress, name: input.name.trim() });
    } catch (error) {
      if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
      throw error;
    }
  }
}
