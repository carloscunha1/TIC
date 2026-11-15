import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { ProductRepository } from './product.repository.js';
import type { UpdateProductInput } from './product.schemas.js';

export class ProductUpdateService {
  constructor(private readonly repository: ProductRepository) {}

  async get(id: string) {
    const product = await this.repository.findById(id);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
    return product;
  }

  async history(id: string) {
    await this.get(id);
    const history = await this.repository.listValueHistory(id);
    return history.map((entry) => ({ ...entry, previousValue: entry.previousValue.toString(), newValue: entry.newValue.toString() }));
  }

  async update(id: string, input: UpdateProductInput, actorUserId: string, ipAddress?: string) {
    const current = await this.get(id);
    if (input.categoryId !== current.categoryId && !await this.repository.findActiveCategory(input.categoryId)) {
      throw new ApiError(400, 'CATEGORY_INACTIVE_OR_NOT_FOUND', 'A categoria deve existir e estar ativa.');
    }
    try {
      return await this.repository.update(id, { ...input, name: input.name.trim(), description: input.description?.trim() || null, barcode: input.barcode?.trim() || null, actorUserId, ipAddress });
    } catch (error) {
      if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
      if (error instanceof Error && error.message === 'PRODUCT_STOCK_MODE_IMMUTABLE') throw new ApiError(409, 'PRODUCT_STOCK_MODE_IMMUTABLE', 'A modalidade de estoque não pode ser alterada após movimentações.');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'BARCODE_ALREADY_EXISTS', 'Já existe um produto com este código de barras.');
      throw error;
    }
  }
}
