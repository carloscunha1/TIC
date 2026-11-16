import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createCustomer, quickCreateCustomer } from './customer.controller.js';

export const customerRouter = Router();
customerRouter.use(requireAuth, requirePermission(permissions.customersManage));
customerRouter.post('/', createCustomer);
customerRouter.post('/quick', quickCreateCustomer);
