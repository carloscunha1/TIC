import { randomUUID } from 'node:crypto';
import { Prisma, type Category, type Product, type ProductStatus, type ProductValueHistory, type StockMode } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import { detectProductValueChanges } from './product.value-history.js';

export type CreateProductData = { name: string; description?: string; barcode?: string; categoryId: string; unit: 'UN' | 'KG' | 'G' | 'L' | 'ML'; cost: number; salePrice: number; minimumStock: number; stockMode: 'SIMPLES' | 'LOTE'; expirationAlertDays: number; actorUserId: string; ipAddress?: string };
export type ProductListFilters = { page: number; pageSize: number; search?: string; categoryId?: string; status?: ProductStatus; stockMode?: StockMode };
export type ProductWithBalance = Prisma.ProductGetPayload<{ include: { stockBalance: { select: { quantity: true } } } }>;
export type ProductListResult = { products: ProductWithBalance[]; total: number };
export type UpdateProductData = Omit<CreateProductData, 'actorUserId' | 'ipAddress' | 'barcode' | 'description'> & { barcode?: string | null; description?: string | null };
export interface ProductRepository {
  findActiveCategory(id: string): Promise<Category | null>;
  findById(id: string): Promise<Product | null>;
  create(data: CreateProductData): Promise<Product>;
  list(filters: ProductListFilters): Promise<ProductListResult>;
  update(id: string, data: UpdateProductData & { actorUserId: string; ipAddress?: string }): Promise<Product>;
  updateStatus(id: string, status: ProductStatus, actorUserId: string, ipAddress?: string): Promise<Product>;
  listValueHistory(productId: string): Promise<ProductValueHistory[]>;
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly auditService: AuditService) {}
  findActiveCategory(id: string): Promise<Category | null> { return prisma.category.findFirst({ where: { id, status: 'ACTIVE' } }); }
  findById(id: string): Promise<Product | null> { return prisma.product.findUnique({ where: { id } }); }
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
      prisma.product.findMany({ where, include: { stockBalance: { select: { quantity: true } } }, orderBy: [{ name: 'asc' }, { createdAt: 'desc' }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
      prisma.product.count({ where }),
    ]);
    return { products, total };
  }
  create(data: CreateProductData): Promise<Product> {
    return prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({ data: { barcode: data.barcode, categoryId: data.categoryId, cost: data.cost, description: data.description, expirationAlertDays: data.expirationAlertDays, minimumStock: data.minimumStock, name: data.name, salePrice: data.salePrice, sku: `PRD-${randomUUID()}`, stockMode: data.stockMode, unit: data.unit } });
      if (product.stockMode === 'SIMPLES') await transaction.stockBalance.create({ data: { productId: product.id, quantity: 0 } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'PRODUCT_CREATED', after: { ...product, cost: product.cost.toString(), minimumStock: product.minimumStock.toString(), salePrice: product.salePrice.toString() }, entity: 'Product', entityId: product.id, ipAddress: data.ipAddress }, transaction);
      return product;
    });
  }

  update(id: string, data: UpdateProductData & { actorUserId: string; ipAddress?: string }): Promise<Product> {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const before = await transaction.product.findUnique({ where: { id } });
      if (!before) throw new Error('PRODUCT_NOT_FOUND');
      if (before.stockMode !== data.stockMode) {
        const movementCount = await transaction.stockMovement.count({ where: { productId: id } });
        const balance = await transaction.stockBalance.findUnique({ where: { productId: id }, select: { quantity: true } });
        if (movementCount > 0 || (balance && !balance.quantity.isZero())) throw new Error('PRODUCT_STOCK_MODE_IMMUTABLE');
        if (data.stockMode === 'SIMPLES') {
          await transaction.stockBalance.upsert({ where: { productId: id }, create: { productId: id, quantity: 0 }, update: {} });
        } else {
          await transaction.stockBalance.deleteMany({ where: { productId: id } });
        }
      }
      const product = await transaction.product.update({ where: { id }, data: { barcode: data.barcode, categoryId: data.categoryId, cost: data.cost, description: data.description, expirationAlertDays: data.expirationAlertDays, minimumStock: data.minimumStock, name: data.name, salePrice: data.salePrice, stockMode: data.stockMode, unit: data.unit } });
      const history = detectProductValueChanges(before, data);
      if (history.length) await transaction.productValueHistory.createMany({ data: history.map((item) => ({ ...item, productId: id, changedByUserId: data.actorUserId, source: 'MANUAL_EDIT' })) });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'PRODUCT_UPDATED', before: { ...before, cost: before.cost.toString(), minimumStock: before.minimumStock.toString(), salePrice: before.salePrice.toString() }, after: { ...product, cost: product.cost.toString(), minimumStock: product.minimumStock.toString(), salePrice: product.salePrice.toString() }, entity: 'Product', entityId: id, ipAddress: data.ipAddress }, transaction);
      return product;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  updateStatus(id: string, status: ProductStatus, actorUserId: string, ipAddress?: string): Promise<Product> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.product.findUnique({ where: { id } });
      if (!before) throw new Error('PRODUCT_NOT_FOUND');
      const product = await transaction.product.update({ where: { id }, data: { status } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'PRODUCT_STATUS_UPDATED', before: { ...before, cost: before.cost.toString(), minimumStock: before.minimumStock.toString(), salePrice: before.salePrice.toString() }, after: { ...product, cost: product.cost.toString(), minimumStock: product.minimumStock.toString(), salePrice: product.salePrice.toString() }, entity: 'Product', entityId: id, ipAddress }, transaction);
      return product;
    });
  }

  listValueHistory(productId: string) {
    return prisma.productValueHistory.findMany({ where: { productId }, include: { changedByUser: { select: { name: true } } }, orderBy: [{ changedAt: 'desc' }, { id: 'desc' }] });
  }
}
