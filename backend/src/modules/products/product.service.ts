import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { CreateProductInput } from './product.schemas.js';
import type { ProductRepository } from './product.repository.js';

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async create(input: CreateProductInput, actorUserId: string, ipAddress?: string) {
    const category = await this.repository.findActiveCategory(input.categoryId);
    if (!category) throw new ApiError(400, 'CATEGORY_INACTIVE_OR_NOT_FOUND', 'A categoria deve existir e estar ativa.');
    try {
      return await this.repository.create({ ...input, actorUserId, ipAddress, description: input.description || undefined, barcode: input.barcode || undefined, name: input.name.trim() });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'BARCODE_ALREADY_EXISTS', 'Já existe um produto com este código de barras.');
      throw error;
    }
  }
}
