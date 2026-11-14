import type { Request, Response } from 'express';
import { loginSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
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

  response.cookie('tic_session', result.token, {
    httpOnly: true,
    maxAge: result.expiresAt.getTime() - Date.now(),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  response.status(200).json({
    success: true,
    data: { expiresAt: result.expiresAt.toISOString() },
    requestId: response.locals.requestId,
  });
}
