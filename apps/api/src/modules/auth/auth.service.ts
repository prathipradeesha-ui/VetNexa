import type { LoginInput, RegisterData } from '@vetnexa/shared';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { hashPassword, verifyPassword } from './password';
import { toPublicUser } from './user.serializer';

/** Business logic for accounts. Routes call these functions; only this layer talks to Prisma. */
export function authService(prisma: PrismaClient) {
  return {
    async register(data: RegisterData) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw HttpError.conflict('An account with this email already exists', 'email');
      }

      if (data.role === 'VET' && data.licenseNumber) {
        const licenceTaken = await prisma.vetProfile.findUnique({
          where: { licenseNumber: data.licenseNumber },
        });
        if (licenceTaken) {
          throw HttpError.conflict('This licence number is already registered', 'licenseNumber');
        }
      }

      const user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash: await hashPassword(data.password),
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          role: data.role,
          // Vets start unverified; an administrator approves them after checking the licence.
          ...(data.role === 'VET' && {
            vetProfile: {
              create: {
                licenseNumber: data.licenseNumber!,
                specialization: data.specialization ?? null,
              },
            },
          }),
        },
        include: { vetProfile: true },
      });

      return toPublicUser(user);
    },

    async login({ email, password }: LoginInput) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { vetProfile: true },
      });
      const passwordOk = await verifyPassword(password, user?.passwordHash ?? null);

      // Same message for "no such email" and "wrong password" so accounts cannot be discovered.
      if (!user || !passwordOk) {
        throw HttpError.unauthorized('Incorrect email or password');
      }
      if (user.status === 'SUSPENDED') {
        throw HttpError.forbidden('This account has been suspended. Please contact support.');
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: { vetProfile: true },
      });
      return toPublicUser(updated);
    },
  };
}
