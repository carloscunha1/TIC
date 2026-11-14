import request from 'supertest';
import { app } from './app.js';

describe('GET /api/v1/health', () => {
  it('returns the API health status and a request ID', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'tic-api',
        status: 'ok',
      },
    });
    expect(response.body.requestId).toEqual(response.headers['x-request-id']);
  });
});

describe('unknown routes', () => {
  it('returns the standard error response without a stack trace', async () => {
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      code: 'ROUTE_NOT_FOUND',
    });
    expect(response.body.stack).toBeUndefined();
  });
});
