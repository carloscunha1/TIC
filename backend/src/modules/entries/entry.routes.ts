import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { cancelEntry, confirmEntry, createEntry, getEntry, listEntries, updateEntry } from './entry.controller.js';

export const entryRouter = Router();
entryRouter.use(requireAuth, requirePermission(permissions.entriesManage));
entryRouter.post('/', createEntry);
entryRouter.get('/', listEntries);
entryRouter.post('/:id/confirm', confirmEntry);
entryRouter.post('/:id/cancel', cancelEntry);
entryRouter.get('/:id', getEntry);
entryRouter.patch('/:id', updateEntry);
