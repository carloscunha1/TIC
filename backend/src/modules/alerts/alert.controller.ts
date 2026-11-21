import type { Request, Response } from 'express';
import { ApiError } from '../../shared/http/api-error.js';
import { alertIdParamSchema, alertListQuerySchema } from './alert.schemas.js';
import { AlertService } from './alert.service.js';

const service = new AlertService();

export async function listAlerts(request: Request, response: Response): Promise<void> {
  const result = await service.list(alertListQuerySchema.parse(request.query), response.locals.auth.userId);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function readAlert(request: Request, response: Response): Promise<void> {
  const { id } = alertIdParamSchema.parse(request.params);
  try { await service.markRead(id, response.locals.auth.userId); } catch (error) { if (error instanceof Error && error.message === 'ALERT_NOT_FOUND') throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alerta não encontrado.'); throw error; }
  response.status(204).send();
}

export async function readAllAlerts(_request: Request, response: Response): Promise<void> {
  await service.markAllRead(response.locals.auth.userId);
  response.status(204).send();
}
