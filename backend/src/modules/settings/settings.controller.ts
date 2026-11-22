import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { PrismaEstablishmentSettingsRepository } from './settings.repository.js';
import { establishmentSettingsSchema } from './settings.schemas.js';
import { EstablishmentSettingsService } from './settings.service.js';

const service = new EstablishmentSettingsService(
  new PrismaEstablishmentSettingsRepository(new AuditService(new PrismaAuditRepository())),
);

export async function getEstablishmentSettings(_request: Request, response: Response): Promise<void> {
  const settings = await service.get();
  response.status(200).json({ success: true, data: { settings }, requestId: response.locals.requestId });
}

export async function updateEstablishmentSettings(request: Request, response: Response): Promise<void> {
  const settings = await service.update(establishmentSettingsSchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: { settings }, requestId: response.locals.requestId });
}
