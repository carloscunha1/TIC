import type { Request, Response } from 'express';
import { loginSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './auth.cookies.js';
import { sessionService } from './auth.middleware.js';
import { PrismaSessionRepository } from './session.repository.js';
import { PrismaUserRepository } from './user.repository.js';

const authService = new AuthService({
  jwtSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'development-only-secret'),
  sessionRepository: new PrismaSessionRepository(),
  userRepository: new PrismaUserRepository(),
});

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be configured in production.');
}

export async function login(request: Request, response: Response): Promise<void> {
  const input = loginSchema.parse(request.body);
  const result = await authService.login(input);

  setSessionCookie(response, result.token, result.expiresAt);

  response.status(200).json({
    success: true,
    data: { expiresAt: result.expiresAt.toISOString() },
    requestId: response.locals.requestId,
  });
}

export async function currentSession(_request: Request, response: Response): Promise<void> {
  const session = response.locals.auth;
  response.status(200).json({
    success: true,
    data: {
      email: session.email,
      expiresAt: session.expiresAt.toISOString(),
      name: session.name,
      role: session.role,
      userId: session.userId,
    },
    requestId: response.locals.requestId,
  });
}

export async function logout(request: Request, response: Response): Promise<void> {
  await sessionService.logout(readSessionCookie(request.header('cookie')));
  clearSessionCookie(response);
  response.status(204).send();
}
