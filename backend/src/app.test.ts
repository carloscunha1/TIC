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

describe('loyalty routes', () => {
  it('requires an authenticated administrative session', async () => {
    const responses = await Promise.all([
      request(app).get('/api/v1/loyalty/customers/00000000-0000-4000-8000-000000000000/balance'),
      request(app).post('/api/v1/loyalty/awards').send({}),
      request(app).post('/api/v1/loyalty/redemptions').send({}),
      request(app).post('/api/v1/loyalty/award-reversals').send({}),
      request(app).post('/api/v1/loyalty/redemption-reversals').send({}),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
    expect(responses.every((response) => response.body.code === 'INVALID_SESSION')).toBe(true);
  });
});
