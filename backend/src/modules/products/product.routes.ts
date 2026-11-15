import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createProduct, listProducts } from './product.controller.js';

export const productRouter = Router();
productRouter.post('/', requireAuth, requirePermission(permissions.productsManage), createProduct);
productRouter.get('/', requireAuth, requirePermission(permissions.productsRead), listProducts);
