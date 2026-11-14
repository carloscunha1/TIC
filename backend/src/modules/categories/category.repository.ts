import type { Category, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateCategoryData = { name: string; description?: string; actorUserId: string; ipAddress?: string };

export interface CategoryRepository {
  create(data: CreateCategoryData): Promise<Category>;
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
}
