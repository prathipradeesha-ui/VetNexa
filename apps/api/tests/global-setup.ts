import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from '../vitest.config';

/** Runs once before the whole test suite: brings the test database schema up to date. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
    // Run from apps/api so Prisma finds its config, whichever folder the tests were started from.
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  });
}
