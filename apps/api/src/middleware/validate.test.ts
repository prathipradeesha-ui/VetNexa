import { loginSchema } from '@vetnexa/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from './error-handler';
import { validate } from './validate';

// A tiny app with one route, so the middleware is tested in isolation.
const app = express();
app.use(express.json());
app.post('/login', validate(loginSchema), (_req, res) => {
  res.json({ received: res.locals['body'] });
});
app.use(errorHandler);

describe('validate middleware', () => {
  it('passes cleaned data to the handler', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: '  Owner@VetNexa.lk ', password: 'secret', extra: 'ignored' });

    expect(res.status).toBe(200);
    // Email trimmed and lower-cased, unknown fields stripped.
    expect(res.body.received).toEqual({ email: 'owner@vetnexa.lk', password: 'secret' });
  });

  it('returns 422 with a message for every invalid field', async () => {
    const res = await request(app).post('/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'email', message: 'Enter a valid email address' },
        expect.objectContaining({ field: 'password' }),
      ]),
    );
  });
});
