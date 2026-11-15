import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login } from './auth.controller.js';
import { completePasswordReset, currentSession, logout } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const loginRateLimit = rateLimit({
  legacyHeaders: false,
  max: 10,
  message: {
    success: false,
    message: 'Não foi possível autenticar. Tente novamente mais tarde.',
    code: 'AUTH_RATE_LIMITED',
    details: {},
  },
  standardHeaders: 'draft-7',
  windowMs: 15 * 60 * 1000,
});

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, login);
authRouter.get('/session', requireAuth, currentSession);
authRouter.post('/logout', logout);
authRouter.post('/password-reset/complete', completePasswordReset);
