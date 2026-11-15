import type { UserStatus } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';
import type { ListCategoriesQuery } from './category.list.schemas.js';

export type CategoryListResponse = {
  categories: Array<{ id: string; name: string; description: string | null; status: UserStatus; createdAt: Date }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export class CategoryListService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async list(query: ListCategoriesQuery): Promise<CategoryListResponse> {
    const result = await this.categoryRepository.list({ page: query.page, pageSize: query.pageSize, name: query.name || undefined, status: query.status as UserStatus | undefined });
    return {
      categories: result.categories.map(({ createdAt, description, id, name, status }) => ({ createdAt, description, id, name, status })),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }
}
