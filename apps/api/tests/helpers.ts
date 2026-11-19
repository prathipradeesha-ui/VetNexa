import { createApp } from '../src/app';
import { createPrismaClient } from '../src/lib/prisma';

/** Prisma client connected to the test database (DATABASE_URL is set by vitest.config.ts). */
export const testPrisma = createPrismaClient();

/** A fully configured app wired to the test database. */
export const testApp = () => createApp({ prisma: testPrisma });
