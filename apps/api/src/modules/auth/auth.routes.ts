import { loginSchema, registerSchema } from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { authenticate, currentUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authService } from './auth.service';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from './session';
import { toPublicUser, type PublicUser } from './user.serializer';

/**
 * /api/auth
 *   POST /register  create an account and sign in
 *   POST /login     sign in with email and password
 *   POST /logout    clear the session cookie
 *   GET  /me        the signed-in user's profile
 */
export function authRouter(prisma: PrismaClient, loginLimiter: RequestHandler) {
  const router = Router();
  const service = authService(prisma);

  const startSession = (res: Parameters<RequestHandler>[1], user: PublicUser) => {
    res.cookie(
      SESSION_COOKIE,
      createSessionToken({ sub: user.id, role: user.role }),
      sessionCookieOptions(),
    );
  };

  router.post('/register', loginLimiter, validate(registerSchema), async (_req, res) => {
    const user = await service.register(res.locals['body']);
    startSession(res, user);
    res.status(201).json({ user });
  });

  router.post('/login', loginLimiter, validate(loginSchema), async (_req, res) => {
    const user = await service.login(res.locals['body']);
    startSession(res, user);
    res.json({ user });
  });

  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...options } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
    res.status(204).end();
  });

  router.get('/me', authenticate(prisma), async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: currentUser(req).id },
      include: { vetProfile: true },
    });
    if (!user) throw HttpError.unauthorized();
    res.json({ user: toPublicUser(user) });
  });

  return router;
}
