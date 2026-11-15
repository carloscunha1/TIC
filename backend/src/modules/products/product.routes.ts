import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createProduct, getProduct, getProductValueHistory, listProducts, updateProduct, updateProductStatus } from './product.controller.js';

export const productRouter = Router();
productRouter.post('/', requireAuth, requirePermission(permissions.productsManage), createProduct);
productRouter.get('/', requireAuth, requirePermission(permissions.productsRead), listProducts);
productRouter.get('/:id', requireAuth, requirePermission(permissions.productsManage), getProduct);
productRouter.get('/:id/value-history', requireAuth, requirePermission(permissions.productsManage), getProductValueHistory);
productRouter.patch('/:id', requireAuth, requirePermission(permissions.productsManage), updateProduct);
productRouter.patch('/:id/status', requireAuth, requirePermission(permissions.productsManage), updateProductStatus);
