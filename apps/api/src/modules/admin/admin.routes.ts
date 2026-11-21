import {
  accountStatusSchema,
  adminUserQuerySchema,
  clinicActiveSchema,
  clinicFormSchema,
  contactStatusSchema,
  contentQuerySchema,
  reviewModerationSchema,
  type AdminUserQuery,
  type ClinicFormData,
} from '@vetnexa/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { authenticate, authorize, currentUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { adminService } from './admin.service';
import { collectStats } from './admin.stats';

const verificationSchema = z.object({ approved: z.boolean() });
const userIdParams = z.object({ userId: z.string().min(1).max(40) });
const idParams = z.object({ id: z.string().min(1).max(40) });
const clinicQuery = z.object({ q: z.string().trim().max(80).optional() });

type Locals = Record<string, unknown>;
const params = <T>(locals: Locals) => locals['params'] as T;
const body = <T>(locals: Locals) => locals['body'] as T;
const query = <T>(locals: Locals) => locals['query'] as T;

/**
 * /api/admin – administrator-only routes. Every route here requires the ADMIN role.
 *
 *   GET   /stats                          platform statistics (counts only)
 *   GET   /users                          users, filtered and paginated (?q, role, status, page)
 *   PATCH /users/:userId/status           suspend or reactivate an account
 *   GET   /vets/pending                   vets waiting for licence verification
 *   PATCH /vets/:userId/verification      approve or revoke a vet's verification
 *   GET   /clinics                        all clinics, including hidden ones (?q)
 *   POST  /clinics                        add a clinic
 *   GET   /clinics/:id                    one clinic with every field
 *   PUT   /clinics/:id                    edit a clinic
 *   PATCH /clinics/:id/active             show or hide a clinic in the directory
 *   GET   /reviews                        reviews (?status, page)
 *   PATCH /reviews/:id                    approve (show) or reject (hide) a review
 *   GET   /messages                       contact messages (?status, page)
 *   PATCH /messages/:id                   change a message's status
 */
export function adminRouter(prisma: PrismaClient) {
  const router = Router();
  const service = adminService(prisma);
  router.use(authenticate(prisma), authorize('ADMIN'));

  router.get('/stats', async (_req, res) => {
    res.json({ stats: await collectStats(prisma) });
  });

  // ── Users ──

  router.get('/users', validate(adminUserQuerySchema, 'query'), async (_req, res) => {
    res.json(await service.listUsers(query<AdminUserQuery>(res.locals)));
  });

  router.patch(
    '/users/:userId/status',
    validate(userIdParams, 'params'),
    validate(accountStatusSchema),
    async (req, res) => {
      const { userId } = params<z.infer<typeof userIdParams>>(res.locals);
      const { status } = body<z.infer<typeof accountStatusSchema>>(res.locals);
      res.json({ user: await service.setUserStatus(currentUser(req).id, userId, status) });
    },
  );

  // ── Veterinarian verification ──

  router.get('/vets/pending', async (_req, res) => {
    const vets = await prisma.vetProfile.findMany({
      where: { isVerified: false, user: { status: 'ACTIVE' } },
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
      const { userId } = params<z.infer<typeof userIdParams>>(res.locals);
      const { approved } = body<z.infer<typeof verificationSchema>>(res.locals);

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

  // ── Clinics ──

  router.get('/clinics', validate(clinicQuery, 'query'), async (_req, res) => {
    const { q } = query<z.infer<typeof clinicQuery>>(res.locals);
    res.json({ clinics: await service.listClinics(q || undefined) });
  });

  router.post('/clinics', validate(clinicFormSchema), async (_req, res) => {
    const clinic = await service.createClinic(body<ClinicFormData>(res.locals));
    res.status(201).json({ clinic });
  });

  router.get('/clinics/:id', validate(idParams, 'params'), async (_req, res) => {
    const { id } = params<z.infer<typeof idParams>>(res.locals);
    res.json({ clinic: await service.getClinic(id) });
  });

  router.put(
    '/clinics/:id',
    validate(idParams, 'params'),
    validate(clinicFormSchema),
    async (_req, res) => {
      const { id } = params<z.infer<typeof idParams>>(res.locals);
      res.json({ clinic: await service.updateClinic(id, body<ClinicFormData>(res.locals)) });
    },
  );

  router.patch(
    '/clinics/:id/active',
    validate(idParams, 'params'),
    validate(clinicActiveSchema),
    async (_req, res) => {
      const { id } = params<z.infer<typeof idParams>>(res.locals);
      const { isActive } = body<z.infer<typeof clinicActiveSchema>>(res.locals);
      res.json({ clinic: await service.setClinicActive(id, isActive) });
    },
  );

  // ── Reviews ──

  router.get('/reviews', validate(contentQuerySchema, 'query'), async (_req, res) => {
    const { status, page } = query<z.output<typeof contentQuerySchema>>(res.locals);
    res.json(await service.listReviews(status, page));
  });

  router.patch(
    '/reviews/:id',
    validate(idParams, 'params'),
    validate(reviewModerationSchema),
    async (_req, res) => {
      const { id } = params<z.infer<typeof idParams>>(res.locals);
      const { status } = body<z.infer<typeof reviewModerationSchema>>(res.locals);
      res.json({ review: await service.moderateReview(id, status) });
    },
  );

  // ── Contact messages ──

  router.get('/messages', validate(contentQuerySchema, 'query'), async (_req, res) => {
    const { status, page } = query<z.output<typeof contentQuerySchema>>(res.locals);
    res.json(await service.listMessages(status, page));
  });

  router.patch(
    '/messages/:id',
    validate(idParams, 'params'),
    validate(contactStatusSchema),
    async (_req, res) => {
      const { id } = params<z.infer<typeof idParams>>(res.locals);
      const { status } = body<z.infer<typeof contactStatusSchema>>(res.locals);
      res.json({ message: await service.setMessageStatus(id, status) });
    },
  );

  return router;
}
