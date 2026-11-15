import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createSupplier } from './supplier.controller.js';

export const supplierRouter = Router();
supplierRouter.post('/', requireAuth, requirePermission(permissions.suppliersManage), createSupplier);
