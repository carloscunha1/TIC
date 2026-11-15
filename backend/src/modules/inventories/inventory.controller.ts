import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { inventoryIdParamsSchema, inventoryItemParamsSchema, inventoryListQuerySchema } from './inventory.schemas.js';
import { PrismaInventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';

const inventoryService = new InventoryService(new PrismaInventoryRepository(new AuditService(new PrismaAuditRepository())));

export async function createInventory(request: Request, response: Response): Promise<void> {
  const inventory = await inventoryService.create(request.body, response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { inventory }, requestId: response.locals.requestId });
}

export async function listInventories(request: Request, response: Response): Promise<void> {
  const query = inventoryListQuerySchema.parse(request.query);
  const result = await inventoryService.list(query.page, query.pageSize);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function getInventory(request: Request, response: Response): Promise<void> {
  const { id } = inventoryIdParamsSchema.parse(request.params);
  const inventory = await inventoryService.get(id);
  response.status(200).json({ success: true, data: { inventory }, requestId: response.locals.requestId });
}

export async function recordInventoryCount(request: Request, response: Response): Promise<void> {
  const { id, itemId } = inventoryItemParamsSchema.parse(request.params);
  const item = await inventoryService.recordCount(id, itemId, request.body, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { item }, requestId: response.locals.requestId });
}
