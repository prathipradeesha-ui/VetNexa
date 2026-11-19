import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const DATABASE_URL = 'mysql://user:pass@localhost:3307/vetnexa';

describe('loadEnv', () => {
  it('applies defaults for optional settings', () => {
    const env = loadEnv({ DATABASE_URL });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 4100, LOG_LEVEL: 'info' });
  });

  it('converts PORT to a number', () => {
    expect(loadEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('fails with a readable message when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/Invalid environment configuration:\n {2}- DATABASE_URL/);
  });
});
