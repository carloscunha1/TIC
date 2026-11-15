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
import { PrismaStockLossRepository, PrismaLossReasonAdminRepository } from './stock-loss.repository.js';
import { StockLossService } from './stock-loss.service.js';
import { customStockLossReasonSchema, predefinedLossReasons, updateCustomStockLossReasonSchema, stockLossSchema } from './stock-loss.schemas.js';
import { ApiError } from '../../shared/http/api-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';

const stockAdjustmentService = new StockAdjustmentService(new PrismaStockAdjustmentRepository(new AuditService(new PrismaAuditRepository())));
const stockBalanceService = new StockBalanceService(new PrismaStockBalanceRepository());
const stockExitService = new StockExitService(new PrismaStockExitRepository(new AuditService(new PrismaAuditRepository())));
const stockLossService = new StockLossService(new PrismaStockLossRepository(new AuditService(new PrismaAuditRepository())));
const lossReasonRepository = new PrismaLossReasonAdminRepository(new AuditService(new PrismaAuditRepository()));

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

export async function listStockLossReasons(_request: Request, response: Response): Promise<void> {
  const custom = await lossReasonRepository.list(true);
  response.status(200).json({ success: true, data: { reasons: [...predefinedLossReasons, ...custom.map(({ id, name }) => ({ id, name }))] }, requestId: response.locals.requestId });
}

export async function listCustomStockLossReasons(_request: Request, response: Response): Promise<void> {
  const reasons = await lossReasonRepository.list();
  response.status(200).json({ success: true, data: { reasons }, requestId: response.locals.requestId });
}

export async function createCustomStockLossReason(request: Request, response: Response): Promise<void> {
  const { name } = customStockLossReasonSchema.parse(request.body);
  try {
    const reason = await lossReasonRepository.create(name, response.locals.auth.userId, request.ip);
    response.status(201).json({ success: true, data: { reason }, requestId: response.locals.requestId });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ApiError(409, 'LOSS_REASON_ALREADY_EXISTS', 'Já existe um motivo com este nome.');
    throw error;
  }
}

export async function updateCustomStockLossReason(request: Request, response: Response): Promise<void> {
  const id = request.params.id;
  if (typeof id !== 'string') throw new ApiError(400, 'INVALID_LOSS_REASON_ID', 'Identificador do motivo inválido.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400, 'INVALID_LOSS_REASON_ID', 'Identificador do motivo inválido.');
  const data = updateCustomStockLossReasonSchema.parse(request.body);
  try {
    const reason = await lossReasonRepository.update(id, data, response.locals.auth.userId, request.ip);
    response.status(200).json({ success: true, data: { reason }, requestId: response.locals.requestId });
  } catch (error) {
    if (error instanceof Error && error.message === 'LOSS_REASON_NOT_FOUND') throw new ApiError(404, 'LOSS_REASON_NOT_FOUND', 'Motivo customizado não encontrado.');
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ApiError(409, 'LOSS_REASON_ALREADY_EXISTS', 'Já existe um motivo com este nome.');
    throw error;
  }
}

export async function recordStockLoss(request: Request, response: Response): Promise<void> {
  const result = await stockLossService.record(stockLossSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function listProductLotsForLoss(request: Request, response: Response): Promise<void> {
  const productId = request.params.productId;
  if (typeof productId !== 'string') throw new ApiError(400, 'INVALID_PRODUCT_ID', 'Identificador de produto inválido.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) throw new ApiError(400, 'INVALID_PRODUCT_ID', 'Identificador de produto inválido.');
  const lots = await prisma.stockLot.findMany({ where: { productId, currentQuantity: { gt: 0 } }, orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }, { id: 'asc' }], select: { id: true, identifier: true, expirationDate: true, currentQuantity: true } });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
  const availableLots = lots.map((lot) => ({ ...lot, available: lot.expirationDate === null || lot.expirationDate.toISOString().slice(0, 10) >= today }));
  response.status(200).json({ success: true, data: { lots: availableLots }, requestId: response.locals.requestId });
}
