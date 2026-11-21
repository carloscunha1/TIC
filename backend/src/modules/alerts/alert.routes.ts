import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { listAlerts, readAlert, readAllAlerts } from './alert.controller.js';

export const alertRouter = Router();
alertRouter.use(requireAuth, requirePermission(permissions.dashboardView));
alertRouter.get('/', listAlerts);
alertRouter.post('/read-all', readAllAlerts);
alertRouter.post('/:id/read', readAlert);
