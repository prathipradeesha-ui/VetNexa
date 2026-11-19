import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from '../vitest.config';

/** Runs once before the whole test suite: brings the test database schema up to date. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
