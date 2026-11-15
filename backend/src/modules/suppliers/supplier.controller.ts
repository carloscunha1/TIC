import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { createSupplierSchema } from './supplier.schemas.js';
import { PrismaSupplierRepository } from './supplier.repository.js';
import { SupplierService } from './supplier.service.js';
import { listSuppliersQuerySchema } from './supplier.list.schemas.js';
import { SupplierListService } from './supplier.list.service.js';

const supplierService = new SupplierService(new PrismaSupplierRepository(new AuditService(new PrismaAuditRepository())));
const supplierListService = new SupplierListService(new PrismaSupplierRepository(new AuditService(new PrismaAuditRepository())));

export async function listSuppliers(request: Request, response: Response): Promise<void> {
  const query = listSuppliersQuerySchema.parse(request.query);
  const result = await supplierListService.list(query);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function createSupplier(request: Request, response: Response): Promise<void> {
  const input = createSupplierSchema.parse(request.body);
  const supplier = await supplierService.create(input, response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { supplier }, requestId: response.locals.requestId });
}
