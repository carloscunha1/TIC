import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { createProductSchema } from './product.schemas.js';
import { PrismaProductRepository } from './product.repository.js';
import { ProductService } from './product.service.js';

const productService = new ProductService(new PrismaProductRepository(new AuditService(new PrismaAuditRepository())));

export async function createProduct(request: Request, response: Response): Promise<void> {
  const product = await productService.create(createProductSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { product }, requestId: response.locals.requestId });
}
