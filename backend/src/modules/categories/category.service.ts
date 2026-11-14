import type { Category } from '@prisma/client';
import type { CreateCategoryInput } from './category.schemas.js';
import type { CategoryRepository } from './category.repository.js';

export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  create(input: CreateCategoryInput, actorUserId: string, ipAddress?: string): Promise<Category> {
    return this.categoryRepository.create({
      actorUserId,
      description: input.description?.trim() || undefined,
      ipAddress,
      name: input.name.trim(),
    });
  }
}
