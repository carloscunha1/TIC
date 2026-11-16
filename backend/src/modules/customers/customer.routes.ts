import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createCustomer, listCustomers, quickCreateCustomer } from './customer.controller.js';

export const customerRouter = Router();
customerRouter.use(requireAuth, requirePermission(permissions.customersManage));
customerRouter.get('/', listCustomers);
customerRouter.post('/', createCustomer);
customerRouter.post('/quick', quickCreateCustomer);
