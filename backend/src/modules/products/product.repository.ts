import { randomUUID } from 'node:crypto';
import type { Category, Product } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateProductData = { name: string; description?: string; barcode?: string; categoryId: string; unit: 'UN' | 'KG' | 'G' | 'L' | 'ML'; cost: number; salePrice: number; minimumStock: number; stockMode: 'SIMPLES' | 'LOTE'; expirationAlertDays: number; actorUserId: string; ipAddress?: string };
export interface ProductRepository { findActiveCategory(id: string): Promise<Category | null>; create(data: CreateProductData): Promise<Product>; }

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly auditService: AuditService) {}
  findActiveCategory(id: string): Promise<Category | null> { return prisma.category.findFirst({ where: { id, status: 'ACTIVE' } }); }
  create(data: CreateProductData): Promise<Product> {
    return prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({ data: { barcode: data.barcode, categoryId: data.categoryId, cost: data.cost, description: data.description, expirationAlertDays: data.expirationAlertDays, minimumStock: data.minimumStock, name: data.name, salePrice: data.salePrice, sku: `PRD-${randomUUID()}`, stockMode: data.stockMode, unit: data.unit } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'PRODUCT_CREATED', after: { ...product, cost: product.cost.toString(), minimumStock: product.minimumStock.toString(), salePrice: product.salePrice.toString() }, entity: 'Product', entityId: product.id, ipAddress: data.ipAddress }, transaction);
      return product;
    });
  }
}
