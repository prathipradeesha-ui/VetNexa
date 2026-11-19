import type { UserRole } from '../generated/prisma/client';

/** The signed-in user, attached to the request by the `authenticate` middleware. */
export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  isVerifiedVet: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
