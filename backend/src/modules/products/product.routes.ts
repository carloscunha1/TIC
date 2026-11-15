import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createProduct } from './product.controller.js';

export const productRouter = Router();
productRouter.post('/', requireAuth, requirePermission(permissions.productsManage), createProduct);
