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

  it('refuses a wildcard or malformed CORS origin', () => {
    expect(() => loadEnv({ DATABASE_URL, JWT_SECRET, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
    expect(() =>
      loadEnv({ DATABASE_URL, JWT_SECRET, CORS_ORIGIN: 'https://*.example.com' }),
    ).toThrow(/CORS_ORIGIN/);
    expect(
      loadEnv({
        DATABASE_URL,
        JWT_SECRET,
        CORS_ORIGIN: 'https://vetnexa.example, http://localhost:8088',
      }).CORS_ORIGIN,
    ).toBe('https://vetnexa.example, http://localhost:8088');
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadEnv({ DATABASE_URL, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });

  it('uses local storage by default and checks S3 settings when S3 is chosen', () => {
    expect(loadEnv({ DATABASE_URL, JWT_SECRET }).STORAGE_DRIVER).toBe('local');
    expect(() => loadEnv({ DATABASE_URL, JWT_SECRET, STORAGE_DRIVER: 's3' })).toThrow(
      /S3_ENDPOINT is required[\s\S]*S3_ACCESS_KEY_ID is required/,
    );
    const s3 = loadEnv({
      DATABASE_URL,
      JWT_SECRET,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://minio:9000',
      S3_ACCESS_KEY_ID: 'vetnexa',
      S3_SECRET_ACCESS_KEY: 'secret-key-123',
    });
    expect(s3).toMatchObject({ S3_BUCKET: 'vetnexa-uploads', S3_FORCE_PATH_STYLE: true });
  });
});
