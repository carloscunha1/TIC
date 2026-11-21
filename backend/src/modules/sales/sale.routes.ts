import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { addSaleItem, createSale, getSale, listSales, removeSaleItem, updateSale, updateSaleItem } from './sale.controller.js';

export const saleRouter = Router();
saleRouter.use(requireAuth, requirePermission(permissions.salesManage));
saleRouter.post('/', createSale);
saleRouter.get('/', listSales);
saleRouter.get('/:id', getSale);
saleRouter.patch('/:id', updateSale);
saleRouter.post('/:id/items', addSaleItem);
saleRouter.patch('/:id/items/:itemId', updateSaleItem);
saleRouter.delete('/:id/items/:itemId', removeSaleItem);
