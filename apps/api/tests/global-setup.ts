import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from '../vitest.config';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs once before the whole test suite: brings the test database schema up to date.
 *
 * On Windows, antivirus scanning can briefly lock Prisma's migration engine right after
 * another Prisma command used it, which fails with EPERM / EBUSY. Those errors are
 * retried a few times; any other error fails immediately.
 */
export default async function setup() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
        // Run from apps/api so Prisma finds its config, whichever folder tests started from.
        cwd: fileURLToPath(new URL('..', import.meta.url)),
      });
      return;
    } catch (error) {
      const output = String((error as { stderr?: Buffer }).stderr ?? error);
      const fileLocked = /EPERM|EBUSY/.test(output);
      if (!fileLocked || attempt === 4) throw error;
      await sleep(3000);
    }
  }
}
