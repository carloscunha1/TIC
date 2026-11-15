import { ApiError } from '../../shared/http/api-error.js';
import type { UserStatus } from '@prisma/client';
import type { CategoryRepository } from './category.repository.js';

export class CategoryStatusService {
  constructor(private readonly repository: CategoryRepository) {}

  async update(id: string, status: UserStatus, actorUserId: string, ipAddress?: string) {
    try {
      return await this.repository.updateStatus(id, status, actorUserId, ipAddress);
    } catch (error) {
      if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
      throw error;
    }
  }
}
