import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/authorization.middleware.js';
import { listAuditLogs } from './audit.controller.js';

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole('ADMIN'));
auditRouter.get('/', listAuditLogs);
