import type { ProductStatus, StockMode } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import type { ListProductsQuery } from './product.list.schemas.js';

export class ProductListService {
  constructor(private readonly repository: ProductRepository) {}

  async list(query: ListProductsQuery) {
    const result = await this.repository.list({ page: query.page, pageSize: query.pageSize, search: query.search || undefined, categoryId: query.categoryId, status: query.status as ProductStatus | undefined, stockMode: query.stockMode as StockMode | undefined });
    return {
      page: query.page,
      pageSize: query.pageSize,
      products: result.products.map(({ barcode, categoryId, description, expirationAlertDays, id, minimumStock, name, salePrice, sku, status, stockBalance, stockMode, unit }) => ({ barcode, categoryId, description, expirationAlertDays, id, minimumStock: minimumStock.toString(), name, salePrice: salePrice.toString(), sku, status, stockBalance: stockBalance?.quantity.toString() ?? null, stockMode, unit })),
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }
}
