import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { createProductSchema } from './product.schemas.js';
import { PrismaProductRepository } from './product.repository.js';
import { ProductService } from './product.service.js';
import { listProductsQuerySchema } from './product.list.schemas.js';
import { ProductListService } from './product.list.service.js';

const productService = new ProductService(new PrismaProductRepository(new AuditService(new PrismaAuditRepository())));
const productListService = new ProductListService(new PrismaProductRepository(new AuditService(new PrismaAuditRepository())));

export async function listProducts(request: Request, response: Response): Promise<void> {
  const result = await productListService.list(listProductsQuerySchema.parse(request.query));
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function createProduct(request: Request, response: Response): Promise<void> {
  const product = await productService.create(createProductSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { product }, requestId: response.locals.requestId });
}
