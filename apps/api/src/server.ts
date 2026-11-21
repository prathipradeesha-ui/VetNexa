import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { objectStore } from './lib/storage';
import { createPrismaClient } from './lib/prisma';

/** Entry point: connects to the database, starts the HTTP server and shuts down cleanly. */
async function start() {
  const prisma = createPrismaClient(env.DATABASE_URL);
  await prisma.$connect();
  // Creates the upload folder or MinIO bucket if needed, and fails fast if it is unreachable.
  const store = objectStore();
  await store.ready();
  logger.info(`Photo storage: ${store.driver}`);

  const app = createApp({ prisma });
  const server = app.listen(env.PORT, () => {
    logger.info(`VetNexa API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Finish in-flight requests and close the database pool when Docker or Ctrl+C stops the process.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exit(1);
});
