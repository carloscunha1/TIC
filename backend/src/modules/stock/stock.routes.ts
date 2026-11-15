import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createCustomStockLossReason, listCustomStockLossReasons, listProductLotsForLoss, listStockBalances, listStockLossReasons, recordStockAdjustment, recordStockExit, recordStockLoss, updateCustomStockLossReason } from './stock.controller.js';

export const stockRouter = Router();
stockRouter.use(requireAuth, requirePermission(permissions.stockManage));
stockRouter.get('/balances', listStockBalances);
stockRouter.post('/adjustments', recordStockAdjustment);
stockRouter.post('/exits', recordStockExit);
stockRouter.get('/loss-reasons', listStockLossReasons);
stockRouter.post('/losses', recordStockLoss);
stockRouter.get('/products/:productId/lots', listProductLotsForLoss);
stockRouter.get('/loss-reasons/custom', requirePermission(permissions.settingsManage), listCustomStockLossReasons);
stockRouter.post('/loss-reasons/custom', requirePermission(permissions.settingsManage), createCustomStockLossReason);
stockRouter.patch('/loss-reasons/custom/:id', requirePermission(permissions.settingsManage), updateCustomStockLossReason);
