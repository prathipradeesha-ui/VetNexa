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
import { clinicsRouter } from './modules/clinics/clinics.routes';
import { contactRouter } from './modules/contact/contact.routes';
import {
  consultationsRouter,
  vetPortalRouter,
  vetsRouter,
} from './modules/consultations/consultations.routes';
import { petsRouter } from './modules/pets/pets.routes';
import { recordsRouter, remindersRouter } from './modules/records/records.routes';
import { uploadRoot, UPLOADS_URL_PREFIX } from './lib/uploads';
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

  // Uploaded photos. Names are random and files are re-encoded images, so they are safe to serve;
  // Helmet's nosniff header stops browsers from treating them as anything else.
  app.use(
    UPLOADS_URL_PREFIX,
    express.static(uploadRoot(), {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      fallthrough: false,
    }),
  );

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

  // Contact form: 5 messages per hour per IP address.
  const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !rateLimits,
    handler: (_req, _res, next) =>
      next(HttpError.tooManyRequests('You have sent several messages. Please try again later.')),
  });

  // Reviews: 10 saves per hour per IP, to stop review flooding.
  const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !rateLimits,
    handler: (_req, _res, next) => next(HttpError.tooManyRequests()),
  });

  // ── Routes ──
  app.use('/api/health', healthRouter(prisma));
  app.use('/api/auth', authRouter(prisma, loginLimiter));
  app.use('/api/admin', adminRouter(prisma));
  app.use('/api/contact', contactRouter(prisma, contactLimiter));
  app.use('/api/pets/:petId/records', recordsRouter(prisma));
  app.use('/api/pets', petsRouter(prisma));
  app.use('/api/reminders', remindersRouter(prisma));
  app.use('/api/clinics', clinicsRouter(prisma, reviewLimiter));
  app.use('/api/consultations', consultationsRouter(prisma));
  app.use('/api/vet', vetPortalRouter(prisma));
  app.use('/api/vets', vetsRouter(prisma));

  // ── Errors (must be registered last) ──
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
