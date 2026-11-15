import type { RequestHandler } from 'express';
import { ApiError } from '../../shared/http/api-error.js';
import { roleHasPermission, type Permission } from './permissions.js';

export function requirePermission(permission: Permission): RequestHandler {
  return (_request, response, next) => {
    const auth = response.locals.auth;
    if (!auth || !roleHasPermission(auth.role, permission)) {
      next(new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para executar esta ação.'));
      return;
    }
    next();
  };
}

export function requireRole(...roles: string[]): RequestHandler {
  return (_request, response, next) => {
    const auth = response.locals.auth;
    if (!auth || !roles.includes(auth.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para executar esta ação.'));
      return;
    }
    next();
  };
}
