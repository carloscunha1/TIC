import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { cancelEntrySchema, entryDraftSchema, entryIdParamSchema, entryListQuerySchema } from './entry.schemas.js';
import { PrismaEntryRepository } from './entry.repository.js';
import { EntryService } from './entry.service.js';
import { PrismaEntryConfirmationRepository } from './entry-confirmation.repository.js';
import { EntryConfirmationService } from './entry.confirmation.service.js';
import { PrismaEntryCancellationRepository } from './entry-cancellation.repository.js';
import { EntryCancellationService } from './entry.cancellation.service.js';

const entryService = new EntryService(new PrismaEntryRepository(new AuditService(new PrismaAuditRepository())));
const entryConfirmationService = new EntryConfirmationService(new PrismaEntryConfirmationRepository(new AuditService(new PrismaAuditRepository())));
const entryCancellationService = new EntryCancellationService(new PrismaEntryCancellationRepository(new AuditService(new PrismaAuditRepository())));

export async function createEntry(request: Request, response: Response): Promise<void> {
  const entry = await entryService.create(entryDraftSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(201).json({ success: true, data: { entry }, requestId: response.locals.requestId });
}

export async function updateEntry(request: Request, response: Response): Promise<void> {
  const { id } = entryIdParamSchema.parse(request.params);
  const entry = await entryService.update(id, entryDraftSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { entry }, requestId: response.locals.requestId });
}

export async function getEntry(request: Request, response: Response): Promise<void> {
  const { id } = entryIdParamSchema.parse(request.params);
  const entry = await entryService.get(id);
  response.status(200).json({ success: true, data: { entry }, requestId: response.locals.requestId });
}

export async function listEntries(request: Request, response: Response): Promise<void> {
  const query = entryListQuerySchema.parse(request.query);
  const result = await entryService.list(query.page, query.pageSize);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function confirmEntry(request: Request, response: Response): Promise<void> {
  const { id } = entryIdParamSchema.parse(request.params);
  const result = await entryConfirmationService.confirm(id, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function cancelEntry(request: Request, response: Response): Promise<void> {
  const { id } = entryIdParamSchema.parse(request.params);
  const { justification } = cancelEntrySchema.parse(request.body);
  const result = await entryCancellationService.cancel(id, justification, response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}
