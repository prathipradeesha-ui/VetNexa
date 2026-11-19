import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../../config/env';
import type { UserRole } from '../../generated/prisma/client';

/**
 * Login sessions are signed JSON Web Tokens stored in an HttpOnly cookie.
 *
 * - HttpOnly: JavaScript in the page cannot read the cookie, so an XSS bug cannot steal it.
 * - SameSite=Lax: the browser does not send it on cross-site form posts (CSRF protection),
 *   together with the strict CORS origin list and JSON-only request bodies.
 * - Secure in production: only sent over HTTPS.
 */
export const SESSION_COOKIE = 'vetnexa_session';

export interface SessionPayload {
  sub: string; // user id
  role: UserRole;
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${env.SESSION_HOURS}h`,
    issuer: 'vetnexa-api',
  });
}

/** Returns the payload of a valid token, or null if it is missing, tampered with or expired. */
export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'vetnexa-api',
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
    return { sub: decoded.sub, role: decoded['role'] as UserRole };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_HOURS * 60 * 60 * 1000,
  };
}
