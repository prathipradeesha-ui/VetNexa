import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const verificationSchema = z.object({ approved: z.boolean() });
const userIdParams = z.object({ userId: z.string().min(1) });

/**
 * /api/admin – administrator-only routes. Every route here requires the ADMIN role.
 *   GET   /vets/pending                 vets waiting for licence verification
 *   PATCH /vets/:userId/verification    approve or revoke a vet's verification
 */
export function adminRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(authenticate(prisma), authorize('ADMIN'));

  router.get('/vets/pending', async (_req, res) => {
    const vets = await prisma.vetProfile.findMany({
      where: { isVerified: false },
      orderBy: { user: { createdAt: 'asc' } },
      select: {
        licenseNumber: true,
        specialization: true,
        yearsExperience: true,
        clinic: { select: { id: true, name: true, city: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });
    res.json({ vets });
  });

  router.patch(
    '/vets/:userId/verification',
    validate(userIdParams, 'params'),
    validate(verificationSchema),
    async (_req, res) => {
      const { userId } = res.locals['params'] as z.infer<typeof userIdParams>;
      const { approved } = res.locals['body'] as z.infer<typeof verificationSchema>;

      const profile = await prisma.vetProfile.findUnique({ where: { userId } });
      if (!profile) throw HttpError.notFound('Veterinarian not found');

      const updated = await prisma.vetProfile.update({
        where: { userId },
        data: { isVerified: approved, verifiedAt: approved ? new Date() : null },
        select: { userId: true, licenseNumber: true, isVerified: true, verifiedAt: true },
      });
      res.json({ vet: updated });
    },
  );

  return router;
}
