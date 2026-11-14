import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { createCategorySchema } from './category.schemas.js';
import { PrismaCategoryRepository } from './category.repository.js';
import { CategoryService } from './category.service.js';

const categoryService = new CategoryService(new PrismaCategoryRepository(new AuditService(new PrismaAuditRepository())));

export async function createCategory(request: Request, response: Response): Promise<void> {
  const input = createCategorySchema.parse(request.body);
  const category = await categoryService.create(input, response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { category }, requestId: response.locals.requestId });
}
