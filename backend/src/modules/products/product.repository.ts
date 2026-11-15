import { randomUUID } from 'node:crypto';
import type { Category, Product, Prisma, ProductStatus, StockMode } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateProductData = { name: string; description?: string; barcode?: string; categoryId: string; unit: 'UN' | 'KG' | 'G' | 'L' | 'ML'; cost: number; salePrice: number; minimumStock: number; stockMode: 'SIMPLES' | 'LOTE'; expirationAlertDays: number; actorUserId: string; ipAddress?: string };
export type ProductListFilters = { page: number; pageSize: number; search?: string; categoryId?: string; status?: ProductStatus; stockMode?: StockMode };
export type ProductListResult = { products: Product[]; total: number };
export interface ProductRepository { findActiveCategory(id: string): Promise<Category | null>; create(data: CreateProductData): Promise<Product>; list(filters: ProductListFilters): Promise<ProductListResult>; }

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly auditService: AuditService) {}
  findActiveCategory(id: string): Promise<Category | null> { return prisma.category.findFirst({ where: { id, status: 'ACTIVE' } }); }
  async list(filters: ProductListFilters): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = {};
    if (filters.search) where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { barcode: { contains: filters.search, mode: 'insensitive' } },
    ];
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.stockMode) where.stockMode = filters.stockMode;
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy: [{ name: 'asc' }, { createdAt: 'desc' }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
      prisma.product.count({ where }),
    ]);
    return { products, total };
  }
  create(data: CreateProductData): Promise<Product> {
    return prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({ data: { barcode: data.barcode, categoryId: data.categoryId, cost: data.cost, description: data.description, expirationAlertDays: data.expirationAlertDays, minimumStock: data.minimumStock, name: data.name, salePrice: data.salePrice, sku: `PRD-${randomUUID()}`, stockMode: data.stockMode, unit: data.unit } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'PRODUCT_CREATED', after: { ...product, cost: product.cost.toString(), minimumStock: product.minimumStock.toString(), salePrice: product.salePrice.toString() }, entity: 'Product', entityId: product.id, ipAddress: data.ipAddress }, transaction);
      return product;
    });
  }
}
