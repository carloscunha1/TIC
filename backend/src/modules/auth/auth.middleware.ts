import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/http/api-error.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './auth.cookies.js';
import { PrismaSessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

const sessionService = new SessionService({
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-secret',
  sessionRepository: new PrismaSessionRepository(),
});

export const requireAuth: RequestHandler = async (request, response, next) => {
  const token = readSessionCookie(request.header('cookie'));
  if (!token) {
    next(new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada.'));
    return;
  }

  try {
    const session = await sessionService.authenticate(token);
    response.locals.auth = session;
    setSessionCookie(response, session.renewedToken, session.expiresAt);
    next();
  } catch (error) {
    clearSessionCookie(response);
    next(error);
  }
};

export { sessionService };
