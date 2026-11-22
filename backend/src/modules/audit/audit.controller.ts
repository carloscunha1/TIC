import type { Request, Response } from 'express';
import { auditListQuerySchema } from './audit.schemas.js';
import { PrismaAuditReadRepository } from './audit-read.repository.js';
import { AuditReadService } from './audit-read.service.js';

const service = new AuditReadService(new PrismaAuditReadRepository());

export async function listAuditLogs(request: Request, response: Response): Promise<void> {
  const query = auditListQuerySchema.parse(request.query);
  const result = await service.list(query);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}
