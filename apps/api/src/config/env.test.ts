import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const DATABASE_URL = 'mysql://user:pass@localhost:3307/vetnexa';
const JWT_SECRET = 'x'.repeat(32);

describe('loadEnv', () => {
  it('applies defaults for optional settings', () => {
    const env = loadEnv({ DATABASE_URL, JWT_SECRET });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4100,
      LOG_LEVEL: 'info',
      SESSION_HOURS: 12,
    });
  });

  it('converts PORT to a number', () => {
    expect(loadEnv({ DATABASE_URL, JWT_SECRET, PORT: '8080' }).PORT).toBe(8080);
  });

  it('fails with a readable message when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/Invalid environment configuration:\n {2}- DATABASE_URL/);
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ DATABASE_URL, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });
});
