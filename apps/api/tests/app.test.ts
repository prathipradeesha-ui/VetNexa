import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { PrismaClient } from '../src/generated/prisma/client';
import { testApp, testPrisma } from './helpers';

afterAll(() => testPrisma.$disconnect());

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await request(testApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'vetnexa-api',
      checks: { database: 'up', storage: 'up' },
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('reports degraded with 503 when the database is down', async () => {
    // A fake client whose query always fails, simulating a lost database connection.
    const brokenPrisma = {
      $queryRaw: () => Promise.reject(new Error('connect ECONNREFUSED')),
    } as unknown as PrismaClient;

    const res = await request(createApp({ prisma: brokenPrisma })).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', checks: { database: 'down' } });
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(testApp()).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Route GET /api/does-not-exist does not exist',
    });
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await request(testApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('security headers and CORS', () => {
  it('sets Helmet security headers and hides the Express signature', async () => {
    const res = await request(testApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured web origin with credentials', async () => {
    const res = await request(testApp()).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow unknown origins', async () => {
    const res = await request(testApp()).get('/api/health').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
