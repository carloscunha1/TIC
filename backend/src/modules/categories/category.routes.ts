import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createCategory, getCategory, listCategories, updateCategory, updateCategoryStatus } from './category.controller.js';

export const categoryRouter = Router();

categoryRouter.post('/', requireAuth, requirePermission(permissions.categoriesManage), createCategory);
categoryRouter.get('/', requireAuth, requirePermission(permissions.categoriesRead), listCategories);
categoryRouter.get('/:id', requireAuth, requirePermission(permissions.categoriesManage), getCategory);
categoryRouter.patch('/:id', requireAuth, requirePermission(permissions.categoriesManage), updateCategory);
categoryRouter.patch('/:id/status', requireAuth, requirePermission(permissions.categoriesManage), updateCategoryStatus);
