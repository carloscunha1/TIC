import type { Request, Response } from 'express';
import { createUserSchema } from './user.schemas.js';
import { UserService } from './user.service.js';
import { PrismaUserRepository } from '../auth/user.repository.js';
import { listUsersQuerySchema } from './user.list.schemas.js';
import { UserListService } from './user.list.service.js';
import { userIdParamSchema, updateUserSchema } from './user.update.schemas.js';
import { UserUpdateService } from './user.update.service.js';
import { UserStatusService } from './user.status.service.js';
import { userStatusSchema } from './user.status.schemas.js';
import { PasswordResetService } from './password-reset.service.js';

const userService = new UserService(new PrismaUserRepository());
const userListService = new UserListService(new PrismaUserRepository());
const userUpdateService = new UserUpdateService(new PrismaUserRepository());
const userStatusService = new UserStatusService(new PrismaUserRepository());
const passwordResetService = new PasswordResetService(new PrismaUserRepository());

export async function issuePasswordReset(request: Request, response: Response): Promise<void> {
  const { id } = userIdParamSchema.parse(request.params);
  const result = await passwordResetService.issue(id);
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function updateUserStatus(request: Request, response: Response): Promise<void> {
  const { id } = userIdParamSchema.parse(request.params);
  const { status } = userStatusSchema.parse(request.body);
  const user = await userStatusService.update(id, status);
  response.status(200).json({ success: true, data: { user }, requestId: response.locals.requestId });
}

export async function getUser(request: Request, response: Response): Promise<void> {
  const { id } = userIdParamSchema.parse(request.params);
  const user = await userUpdateService.findById(id);
  response.status(200).json({ success: true, data: { user }, requestId: response.locals.requestId });
}

export async function updateUser(request: Request, response: Response): Promise<void> {
  const { id } = userIdParamSchema.parse(request.params);
  const input = updateUserSchema.parse(request.body);
  const user = await userUpdateService.update(id, input);
  response.status(200).json({ success: true, data: { user }, requestId: response.locals.requestId });
}

export async function listUsers(request: Request, response: Response): Promise<void> {
  const query = listUsersQuerySchema.parse(request.query);
  const result = await userListService.list(query);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function createUser(request: Request, response: Response): Promise<void> {
  const input = createUserSchema.parse(request.body);
  const user = await userService.create(input);

  response.status(201).json({
    success: true,
    data: { user },
    requestId: response.locals.requestId,
  });
}
