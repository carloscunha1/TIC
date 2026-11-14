import type { Request, Response } from 'express';
import { createUserSchema } from './user.schemas.js';
import { UserService } from './user.service.js';
import { PrismaUserRepository } from '../auth/user.repository.js';

const userService = new UserService(new PrismaUserRepository());

export async function createUser(request: Request, response: Response): Promise<void> {
  const input = createUserSchema.parse(request.body);
  const user = await userService.create(input);

  response.status(201).json({
    success: true,
    data: { user },
    requestId: response.locals.requestId,
  });
}
