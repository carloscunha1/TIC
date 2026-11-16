import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/http/api-error.js';
import { clearCustomerSessionCookie, readCustomerSessionCookie, setCustomerSessionCookie } from './customer-auth.cookies.js';
import { PrismaCustomerSessionRepository } from './customer-session.repository.js';
import { CustomerSessionService } from './customer-session.service.js';
const service = new CustomerSessionService(new PrismaCustomerSessionRepository());
export const requireCustomerAuth: RequestHandler = async (request, response, next) => {
  const token = readCustomerSessionCookie(request.header('cookie'));
  if (!token) { next(new ApiError(401, 'INVALID_CUSTOMER_SESSION', 'Sessão inválida ou expirada.')); return; }
  try { const session = await service.authenticate(token); response.locals.customerAuth = session; setCustomerSessionCookie(response, token, session.expiresAt); next(); }
  catch (error) { clearCustomerSessionCookie(response); next(error); }
};
export { service as customerSessionService };
