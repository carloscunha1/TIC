import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { recordStockAdjustment } from './stock.controller.js';

export const stockRouter = Router();
stockRouter.use(requireAuth, requirePermission(permissions.stockManage));
stockRouter.post('/adjustments', recordStockAdjustment);
