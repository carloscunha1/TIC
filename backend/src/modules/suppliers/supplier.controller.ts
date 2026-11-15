import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { createSupplierSchema } from './supplier.schemas.js';
import { PrismaSupplierRepository } from './supplier.repository.js';
import { SupplierService } from './supplier.service.js';

const supplierService = new SupplierService(new PrismaSupplierRepository(new AuditService(new PrismaAuditRepository())));

export async function createSupplier(request: Request, response: Response): Promise<void> {
  const input = createSupplierSchema.parse(request.body);
  const supplier = await supplierService.create(input, response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { supplier }, requestId: response.locals.requestId });
}
