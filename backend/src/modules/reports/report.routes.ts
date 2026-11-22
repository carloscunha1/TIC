import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { lowRotation, movements, stockPosition, supplierEntries, validity } from './report.controller.js';

export const reportRouter = Router();
reportRouter.use(requireAuth, requirePermission(permissions.reportsRead));
reportRouter.get('/stock/position', stockPosition);
reportRouter.get('/stock/movements', movements);
reportRouter.get('/stock/validity', validity);
reportRouter.get('/stock/low-rotation', lowRotation);
reportRouter.get('/entries/suppliers', supplierEntries);
