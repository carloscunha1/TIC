import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaStockAdjustmentRepository } from './stock-adjustment.repository.js';
import { stockAdjustmentSchema } from './stock-adjustment.schemas.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';
import { PrismaStockBalanceRepository } from './stock-balance.repository.js';
import { StockBalanceService } from './stock-balance.service.js';
import { stockBalanceQuerySchema, stockExitSchema } from './stock.schemas.js';
import { PrismaStockExitRepository } from './stock-exit.repository.js';
import { StockExitService } from './stock-exit.service.js';

const stockAdjustmentService = new StockAdjustmentService(new PrismaStockAdjustmentRepository(new AuditService(new PrismaAuditRepository())));
const stockBalanceService = new StockBalanceService(new PrismaStockBalanceRepository());
const stockExitService = new StockExitService(new PrismaStockExitRepository(new AuditService(new PrismaAuditRepository())));

export async function recordStockAdjustment(request: Request, response: Response): Promise<void> {
  const result = await stockAdjustmentService.record(stockAdjustmentSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function listStockBalances(request: Request, response: Response): Promise<void> {
  const query = stockBalanceQuerySchema.parse(request.query);
  const result = await stockBalanceService.list(query.page, query.pageSize);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function recordStockExit(request: Request, response: Response): Promise<void> {
  const result = await stockExitService.record(stockExitSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}
