import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createUser } from './user.controller.js';

export const userRouter = Router();

userRouter.post('/', requireAuth, requirePermission(permissions.usersManage), createUser);
