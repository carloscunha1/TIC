import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaStockAdjustmentRepository } from './stock-adjustment.repository.js';
import { stockAdjustmentSchema } from './stock-adjustment.schemas.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';

const stockAdjustmentService = new StockAdjustmentService(new PrismaStockAdjustmentRepository(new AuditService(new PrismaAuditRepository())));

export async function recordStockAdjustment(request: Request, response: Response): Promise<void> {
  const result = await stockAdjustmentService.record(stockAdjustmentSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}
