import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/authorization.middleware.js';
import { getEstablishmentSettings, updateEstablishmentSettings } from './settings.controller.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireRole('ADMIN'));
settingsRouter.get('/', getEstablishmentSettings);
settingsRouter.put('/', updateEstablishmentSettings);
