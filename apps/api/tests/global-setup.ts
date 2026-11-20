import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../src/lib/prisma';
import { TEST_DATABASE_URL } from '../vitest.config';

const apiRoot = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Names of the migration folders in prisma/migrations. */
function migrationsOnDisk() {
  return readdirSync(new URL('../prisma/migrations', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * True when every migration on disk has already been applied to the test database.
 * Checking the _prisma_migrations table directly avoids starting Prisma's migration engine
 * on every test run: faster, and it avoids Windows file locks on the engine binary.
 */
async function isUpToDate() {
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const applied = new Set(rows.map((row) => row.migration_name));
    return migrationsOnDisk().every((name) => applied.has(name));
  } catch {
    return false; // the database or the migrations table does not exist yet
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Runs once before the whole test suite: makes sure the test database schema is current.
 * When a migration is needed, file-lock errors (EPERM / EBUSY) caused by antivirus scanning
 * on Windows are retried a few times; any other error fails immediately.
 */
export default async function setup() {
  if (await isUpToDate()) return;

  for (let attempt = 1; ; attempt += 1) {
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
        cwd: apiRoot, // so Prisma finds its config, whichever folder tests started from
      });
      return;
    } catch (error) {
      const output = String((error as { stderr?: Buffer }).stderr ?? error);
      if (!/EPERM|EBUSY/.test(output) || attempt === 6) throw error;
      await sleep(5000);
    }
  }
}
