import type { Request, RequestHandler } from 'express';
import type { PrismaClient, UserRole } from '../generated/prisma/client';
import { HttpError } from '../lib/http-error';
import { readSessionToken, SESSION_COOKIE } from '../modules/auth/session';
import type { AuthUser } from '../types/express';

/**
 * Requires a valid session. Reads the token from the HttpOnly cookie, then re-loads the user
 * from the database on every request. This means a suspended user or a role change takes
 * effect immediately, instead of waiting for the token to expire.
 */
export function authenticate(prisma: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const payload = readSessionToken(req.cookies?.[SESSION_COOKIE]);
    if (!payload) {
      next(HttpError.unauthorized());
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        status: true,
        vetProfile: { select: { isVerified: true } },
      },
    });

    if (!user) {
      next(HttpError.unauthorized('Your session is no longer valid. Please sign in again.'));
      return;
    }
    if (user.status === 'SUSPENDED') {
      next(HttpError.forbidden('This account has been suspended. Please contact support.'));
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      isVerifiedVet: user.role === 'VET' && user.vetProfile?.isVerified === true,
    };
    next();
  };
}

/**
 * For public pages that show a little more to signed-in users (e.g. "your review").
 * Attaches the user when a valid session exists, but never rejects the request.
 */
export function optionalAuthenticate(prisma: PrismaClient): RequestHandler {
  const required = authenticate(prisma);
  return (req, res, next) => {
    if (!readSessionToken(req.cookies?.[SESSION_COOKIE])) {
      next();
      return;
    }
    required(req, res, (error?: unknown) => {
      if (error) req.user = undefined; // e.g. a deleted or suspended account: treat as a visitor
      next();
    });
  };
}

/**
 * Role-based access control. Use after `authenticate`:
 *   router.get('/users', authenticate(prisma), authorize('ADMIN'), handler)
 */
export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(HttpError.unauthorized());
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(HttpError.forbidden());
      return;
    }
    next();
  };
}

/** Vets may only reach clinical data after an administrator has verified their licence. */
export const requireVerifiedVet: RequestHandler = (req, _res, next) => {
  if (req.user?.role === 'VET' && !req.user.isVerifiedVet) {
    next(
      HttpError.forbidden(
        'Your veterinary licence is still being verified. You will get access once it is approved.',
      ),
    );
    return;
  }
  next();
};

/** Returns the signed-in user, for use inside handlers that run after `authenticate`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
