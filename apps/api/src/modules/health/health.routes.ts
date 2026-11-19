import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';

const startedAt = Date.now();

/**
 * GET /api/health
 * Used by Docker and monitoring to check that the API is running and can reach the database.
 * Returns 200 when healthy and 503 when the database cannot be reached.
 */
export function healthRouter(prisma: PrismaClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    const healthy = database === 'up';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      service: 'vetnexa-api',
      version: process.env['npm_package_version'] ?? '0.1.0',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: { database },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
