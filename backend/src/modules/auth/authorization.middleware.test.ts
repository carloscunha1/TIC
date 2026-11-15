import { describe, expect, it } from '@jest/globals';
import { requirePermission } from './authorization.middleware.js';
import { permissions } from './permissions.js';

function runGuard(role: string, permission: typeof permissions[keyof typeof permissions]) {
  let nextError: unknown;
  const next = (error?: unknown) => {
    nextError = error;
  };
  const response = { locals: { auth: { role } } } as never;
  requirePermission(permission)({} as never, response, next);
  return nextError;
}

describe('authorization middleware', () => {
  it('allows an operator to manage products', () => {
    expect(runGuard('OPERATOR', permissions.productsManage)).toBeUndefined();
  });

  it('denies an operator from managing users', () => {
    expect(runGuard('OPERATOR', permissions.usersManage)).toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('denies a viewer from managing products', () => {
    expect(runGuard('VIEWER', permissions.productsManage)).toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('allows a viewer to read products', () => {
    expect(runGuard('VIEWER', permissions.productsRead)).toBeUndefined();
  });
});
