import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { createUser, getUser, listUsers, updateUser, updateUserStatus } from './user.controller.js';

export const userRouter = Router();

userRouter.post('/', requireAuth, requirePermission(permissions.usersManage), createUser);
userRouter.get('/', requireAuth, requirePermission(permissions.usersManage), listUsers);
userRouter.get('/:id', requireAuth, requirePermission(permissions.usersManage), getUser);
userRouter.patch('/:id', requireAuth, requirePermission(permissions.usersManage), updateUser);
userRouter.patch('/:id/status', requireAuth, requirePermission(permissions.usersManage), updateUserStatus);
