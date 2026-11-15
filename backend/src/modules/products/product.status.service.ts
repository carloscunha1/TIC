import { ApiError } from '../../shared/http/api-error.js';
import type { ProductStatus } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';

export class ProductStatusService {
  constructor(private readonly repository: ProductRepository) {}

  async update(id: string, status: ProductStatus, actorUserId: string, ipAddress?: string) {
    try {
      return await this.repository.updateStatus(id, status, actorUserId, ipAddress);
    } catch (error) {
      if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
      throw error;
    }
  }
}
