import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { ZodError } from 'zod';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { supplierRouter } from './modules/suppliers/supplier.routes.js';
import { productRouter } from './modules/products/product.routes.js';
import { entryRouter } from './modules/entries/entry.routes.js';
import { stockRouter } from './modules/stock/stock.routes.js';
import { inventoryRouter } from './modules/inventories/inventory.routes.js';
import { customerRouter } from './modules/customers/customer.routes.js';
import { customerAuthRouter } from './modules/customers/customer-auth.routes.js';
import { loyaltyPolicyRouter } from './modules/loyalty/loyalty-policy.routes.js';
import { ApiError } from './shared/http/api-error.js';

const requestContext: RequestHandler = (request, response, next) => {
  const receivedRequestId = request.header('x-request-id');
  const requestId = receivedRequestId?.match(/^[A-Za-z0-9._-]{1,100}$/)
    ? receivedRequestId
    : randomUUID();
  const startedAt = performance.now();

  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  logStructured('request.started', {
    method: request.method,
    path: request.path,
    requestId,
  });

  response.on('finish', () => {
    logStructured('request.finished', {
      durationMs: Math.round(performance.now() - startedAt),
      method: request.method,
      path: request.path,
      requestId,
      statusCode: response.statusCode,
    });
  });

  next();
};

const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Rota não encontrada: ${request.method} ${request.path}`));
};

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const isApiError = error instanceof ApiError;
  const isValidationError = error instanceof ZodError;
  const statusCode = isApiError ? error.statusCode : isValidationError ? 400 : 500;
  const code = isApiError ? error.code : isValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR';
  const message = isApiError ? error.message : isValidationError ? 'Dados inválidos.' : 'Erro interno do servidor.';
  const details = isApiError ? error.details : isValidationError ? error.flatten().fieldErrors : {};

  logStructured('request.error', {
    code,
    error: sanitizeErrorForLog(error),
    message: isApiError || isValidationError ? message : 'Unhandled application error',
    requestId: response.locals.requestId,
    statusCode,
  });

  response.status(statusCode).json({
    success: false,
    message,
    code,
    details,
    requestId: response.locals.requestId,
  });
};

function sanitizeErrorForLog(error: unknown): { name: string; message: string; stack?: string } {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: 'Non-error value thrown.' };
  const safeMessage = error.message
    .replace(/(password|passwd|pin|token|secret|credential|authorization)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s@]+:[^\s@]+@/gi, '$1[REDACTED]@');
  const safeStack = error.stack?.split('\n').map((line) => line
    .replace(/(password|passwd|pin|token|secret|credential|authorization)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[REDACTED]')
    .replace(/(postgres(?:ql)?:\/\/)[^\s@]+:[^\s@]+@/gi, '$1[REDACTED]@')).join('\n');
  return { name: error.name, message: safeMessage, ...(safeStack ? { stack: safeStack } : {}) };
}

function logStructured(event: string, context: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      event,
      level: 'info',
      timestamp: new Date().toISOString(),
      ...context,
    }),
  );
}

export const app = express();

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use((request, response, next) => {
  const origin = request.header('origin');
  if (origin === frontendOrigin) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  if (request.method === 'OPTIONS') {
    response.status(204).send();
    return;
  }
  next();
});

app.use(requestContext);
app.use(express.json());
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/suppliers', supplierRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/entries', entryRouter);
app.use('/api/v1/stock', stockRouter);
app.use('/api/v1/inventories', inventoryRouter);
app.use('/api/v1/customers', customerRouter);
app.use('/api/v1/customer-auth', customerAuthRouter);
app.use('/api/v1/loyalty/policy', loyaltyPolicyRouter);

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      service: 'tic-api',
      status: 'ok',
    },
    requestId: response.locals.requestId,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);
