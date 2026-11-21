import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { saleDraftSchema, saleIdParamSchema, saleItemIdParamSchema, saleItemInputSchema, saleListQuerySchema, saleUpdateSchema } from './sale.schemas.js';
import { PrismaSaleRepository } from './sale.repository.js';
import { SaleService } from './sale.service.js';

const saleService = new SaleService(new PrismaSaleRepository(new AuditService(new PrismaAuditRepository())));

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
