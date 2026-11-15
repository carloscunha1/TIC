import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { cancelInventory, confirmInventory, createInventory, getInventory, listInventories, recordInventoryCount, submitInventoryForReview } from './inventory.controller.js';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth, requirePermission(permissions.stockManage));
inventoryRouter.post('/', createInventory);
inventoryRouter.get('/', listInventories);
inventoryRouter.get('/:id', getInventory);
inventoryRouter.patch('/:id/items/:itemId/count', recordInventoryCount);
inventoryRouter.post('/:id/review', submitInventoryForReview);
inventoryRouter.post('/:id/confirm', confirmInventory);
inventoryRouter.post('/:id/cancel', cancelInventory);
