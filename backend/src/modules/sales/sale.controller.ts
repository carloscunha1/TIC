import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { saleCancellationSchema, saleConfirmationSchema, saleDraftSchema, saleIdParamSchema, saleItemIdParamSchema, saleItemInputSchema, saleListQuerySchema, saleReturnCancellationSchema, saleReturnSchema, saleUpdateSchema } from './sale.schemas.js';
import { PrismaSaleRepository } from './sale.repository.js';
import { PrismaSaleConfirmationRepository } from './sale-confirmation.repository.js';
import { PrismaSaleCancellationRepository } from './sale-cancellation.repository.js';
import { PrismaSaleReturnRepository } from './sale-return.repository.js';
import { SaleService } from './sale.service.js';

const auditService = new AuditService(new PrismaAuditRepository());
const confirmationRepository = new PrismaSaleConfirmationRepository(auditService);
const cancellationRepository = new PrismaSaleCancellationRepository(auditService);
const returnRepository = new PrismaSaleReturnRepository(auditService);
const saleService = new SaleService(new PrismaSaleRepository(auditService, confirmationRepository, cancellationRepository, returnRepository));

export async function createSale(request: Request, response: Response): Promise<void> {
  const sale = await saleService.create(saleDraftSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function updateSale(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const sale = await saleService.update(id, saleUpdateSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function addSaleItem(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const sale = await saleService.addItem(id, saleItemInputSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function updateSaleItem(request: Request, response: Response): Promise<void> {
  const { id, itemId } = saleItemIdParamSchema.parse(request.params);
  const { quantity } = saleItemInputSchema.pick({ quantity: true }).parse(request.body);
  const sale = await saleService.updateItem(id, itemId, quantity, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function removeSaleItem(request: Request, response: Response): Promise<void> {
  const { id, itemId } = saleItemIdParamSchema.parse(request.params);
  const sale = await saleService.removeItem(id, itemId, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function getSale(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const sale = await saleService.get(id);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function listSales(request: Request, response: Response): Promise<void> {
  const query = saleListQuerySchema.parse(request.query);
  const result = await saleService.list(query.page, query.pageSize);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function confirmSale(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const idempotencyKey = request.header('idempotency-key');
  if (!idempotencyKey || !/^[A-Za-z0-9._-]{1,100}$/.test(idempotencyKey)) {
    response.status(400).json({ success: false, message: 'Informe uma chave de idempotência válida.', code: 'IDEMPOTENCY_KEY_REQUIRED', requestId: response.locals.requestId });
    return;
  }

  const sale = await saleService.confirm(id, saleConfirmationSchema.parse(request.body), idempotencyKey, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function cancelSale(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const sale = await saleService.cancel(id, saleCancellationSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function returnSale(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const idempotencyKey = request.header('idempotency-key');
  if (!idempotencyKey || !/^[A-Za-z0-9._-]{1,100}$/.test(idempotencyKey)) {
    response.status(400).json({ success: false, message: 'Informe uma chave de idempotência válida.', code: 'IDEMPOTENCY_KEY_REQUIRED', requestId: response.locals.requestId });
    return;
  }
  const sale = await saleService.return(id, saleReturnSchema.parse(request.body), idempotencyKey, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}

export async function cancelSaleReturn(request: Request, response: Response): Promise<void> {
  const { id } = saleIdParamSchema.parse(request.params);
  const { justification } = saleReturnCancellationSchema.parse(request.body);
  const sale = await saleService.cancelReturn(id, justification, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { sale }, requestId: response.locals.requestId });
}
