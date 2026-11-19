import { defineConfig } from 'vitest/config';

/**
 * API tests run against a separate MySQL database (vetnexa_test) so they never touch
 * development data. The global setup applies all migrations to it before tests start.
 */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'mysql://vetnexa:vetnexa_dev_password@localhost:3307/vetnexa_test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      CORS_ORIGIN: 'http://localhost:5173',
      JWT_SECRET: 'test-only-secret-that-is-long-enough-1234567890',
    },
    // Integration tests share one database, so test files run one after another.
    fileParallelism: false,
  },
});
