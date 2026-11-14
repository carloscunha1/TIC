import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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
  const statusCode = isApiError ? error.statusCode : 500;
  const code = isApiError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = isApiError ? error.message : 'Erro interno do servidor.';
  const details = isApiError ? error.details : {};

  logStructured('request.error', {
    code,
    message: isApiError ? message : 'Unhandled application error',
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

app.use(requestContext);
app.use(express.json());

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
