import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import type { PrismaClient } from './generated/prisma/client';
import { HttpError } from './lib/http-error';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';

export interface AppDependencies {
  prisma: PrismaClient;
  /** Rate limiting is off by default in tests; a test can switch it on to check it works. */
  rateLimits?: boolean;
}

/**
 * Builds the Express application.
 * Dependencies are passed in (instead of imported) so tests can supply a test database
 * or a fake client, and so Supertest can use the app without starting a real server.
 */
export function createApp({ prisma, rateLimits = env.NODE_ENV !== 'test' }: AppDependencies) {
  const app = express();

  // Behind Nginx / Docker the real client IP comes from X-Forwarded-For (needed for rate limiting).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Security and parsing ──
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true, // allow the auth cookie to be sent from the web app
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        // One short line per request, e.g. "GET /api/pets 200 12ms", without headers.
        customSuccessMessage: (req, res, responseTime) =>
          `${req.method} ${(req as express.Request).originalUrl} ${res.statusCode} ${Math.round(responseTime)}ms`,
        customErrorMessage: (req, res) =>
          `${req.method} ${(req as express.Request).originalUrl} ${res.statusCode} failed`,
        serializers: { req: () => undefined, res: () => undefined },
      }),
    );
  }

  // General limit for every API route; stricter limits are added on login and AI routes later.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !rateLimits,
      handler: (_req, _res, next) => next(HttpError.tooManyRequests()),
    }),
  );

  // Strict limit on sign-in and sign-up to slow down password-guessing attacks.
  // Successful logins do not count towards the limit.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !rateLimits,
    handler: (_req, _res, next) =>
      next(HttpError.tooManyRequests('Too many sign-in attempts. Please wait 15 minutes.')),
  });

  // ── Routes ──
  app.use('/api/health', healthRouter(prisma));
  app.use('/api/auth', authRouter(prisma, loginLimiter));
  app.use('/api/admin', adminRouter(prisma));

  // ── Errors (must be registered last) ──
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
