import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createSupplier, getSupplier, listSuppliers, updateSupplier, updateSupplierStatus } from './supplier.controller.js';

export const supplierRouter = Router();
supplierRouter.post('/', requireAuth, requirePermission(permissions.suppliersManage), createSupplier);
supplierRouter.get('/', requireAuth, requirePermission(permissions.suppliersRead), listSuppliers);
supplierRouter.get('/:id', requireAuth, requirePermission(permissions.suppliersManage), getSupplier);
supplierRouter.patch('/:id', requireAuth, requirePermission(permissions.suppliersManage), updateSupplier);
supplierRouter.patch('/:id/status', requireAuth, requirePermission(permissions.suppliersManage), updateSupplierStatus);
