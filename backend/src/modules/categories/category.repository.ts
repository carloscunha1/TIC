import type { Category, Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateCategoryData = { name: string; description?: string; actorUserId: string; ipAddress?: string };
export type CategoryListFilters = { page: number; pageSize: number; name?: string; status?: UserStatus };
export type CategoryListResult = { categories: Category[]; total: number };

export interface CategoryRepository {
  create(data: CreateCategoryData): Promise<Category>;
  list(filters: CategoryListFilters): Promise<CategoryListResult>;
  findById(id: string): Promise<Category | null>;
  update(id: string, data: { name: string; description?: string; actorUserId: string; ipAddress?: string }): Promise<Category>;
  updateStatus(id: string, status: UserStatus, actorUserId: string, ipAddress?: string): Promise<Category>;
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly auditService: AuditService) {}

  create(data: CreateCategoryData): Promise<Category> {
    return prisma.$transaction(async (transaction) => {
      const category = await transaction.category.create({ data: { description: data.description, name: data.name } });
      await this.auditService.record({
        actor: { type: 'USER', userId: data.actorUserId },
        action: 'CATEGORY_CREATED',
        after: { description: category.description, id: category.id, name: category.name, status: category.status },
        entity: 'Category',
        entityId: category.id,
        ipAddress: data.ipAddress,
      }, transaction);
      return category;
    });
  }

  async list(filters: CategoryListFilters): Promise<CategoryListResult> {
    const where: Prisma.CategoryWhereInput = {};
    if (filters.name) where.name = { contains: filters.name, mode: 'insensitive' };
    if (filters.status) where.status = filters.status;
    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({ orderBy: [{ name: 'asc' }, { createdAt: 'desc' }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize, where }),
      prisma.category.count({ where }),
    ]);
    return { categories, total };
  }

  findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } });
  }

  update(id: string, data: { name: string; description?: string; actorUserId: string; ipAddress?: string }): Promise<Category> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.category.findUnique({ where: { id } });
      if (!before) throw new Error('CATEGORY_NOT_FOUND');
      const category = await transaction.category.update({ where: { id }, data: { description: data.description, name: data.name } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'CATEGORY_UPDATED', before, after: category, entity: 'Category', entityId: id, ipAddress: data.ipAddress }, transaction);
      return category;
    });
  }

  updateStatus(id: string, status: UserStatus, actorUserId: string, ipAddress?: string): Promise<Category> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.category.findUnique({ where: { id } });
      if (!before) throw new Error('CATEGORY_NOT_FOUND');
      const category = await transaction.category.update({ where: { id }, data: { status } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'CATEGORY_STATUS_UPDATED', before, after: category, entity: 'Category', entityId: id, ipAddress }, transaction);
      return category;
    });
  }
}
