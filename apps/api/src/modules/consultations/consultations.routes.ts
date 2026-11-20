import {
  consultationOutcomeSchema,
  consultationRequestSchema,
  consultationStatusSchema,
  type ConsultationOutcomeData,
  type ConsultationRequestData,
  type ConsultationStatusData,
} from '@vetnexa/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, authorize, currentUser, requireVerifiedVet } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { consultationsService, type ListView } from './consultations.service';

const idParams = z.object({ id: z.string().min(1).max(40) });
const listQuery = z.object({
  view: z.enum(['upcoming', 'requests', 'past', 'all']).default('upcoming'),
});

/**
 * /api/consultations – shared by owners and verified vets. Each user only ever sees
 * consultations they take part in.
 *   GET   /                  my consultations (?view=upcoming|requests|past|all)
 *   POST  /                  owner requests a consultation
 *   GET   /:id               one consultation
 *   PATCH /:id/status        confirm (vet) or cancel (vet or owner)
 *   POST  /:id/complete      vet records the outcome
 */
export function consultationsRouter(prisma: PrismaClient) {
  const router = Router();
  const service = consultationsService(prisma);
  const idOf = (locals: Record<string, unknown>) =>
    (locals['params'] as z.infer<typeof idParams>).id;
  router.use(authenticate(prisma), authorize('OWNER', 'VET'), requireVerifiedVet);

  router.get('/', validate(listQuery, 'query'), async (req, res) => {
    const { view } = res.locals['query'] as { view: ListView };
    res.json({ consultations: await service.list(currentUser(req), view) });
  });

  router.post('/', authorize('OWNER'), validate(consultationRequestSchema), async (req, res) => {
    const data = res.locals['body'] as ConsultationRequestData;
    res.status(201).json({ consultation: await service.request(currentUser(req), data) });
  });

  router.get('/:id', validate(idParams, 'params'), async (req, res) => {
    res.json({ consultation: await service.get(currentUser(req), idOf(res.locals)) });
  });

  router.patch(
    '/:id/status',
    validate(idParams, 'params'),
    validate(consultationStatusSchema),
    async (req, res) => {
      const change = res.locals['body'] as ConsultationStatusData;
      res.json({
        consultation: await service.setStatus(currentUser(req), idOf(res.locals), change),
      });
    },
  );

  router.post(
    '/:id/complete',
    authorize('VET'),
    validate(idParams, 'params'),
    validate(consultationOutcomeSchema),
    async (req, res) => {
      const outcome = res.locals['body'] as ConsultationOutcomeData;
      res.json({
        consultation: await service.complete(currentUser(req), idOf(res.locals), outcome),
      });
    },
  );

  return router;
}

/**
 * /api/vet – the veterinary portal (verified vets only).
 *   GET /summary            dashboard numbers and today's schedule
 *   GET /patients/:petId    a patient's profile and history (needs a consultation with it)
 */
export function vetPortalRouter(prisma: PrismaClient) {
  const router = Router();
  const service = consultationsService(prisma);
  router.use(authenticate(prisma), authorize('VET'), requireVerifiedVet);

  router.get('/summary', async (req, res) => {
    res.json(await service.vetSummary(currentUser(req)));
  });

  router.get(
    '/patients/:petId',
    validate(z.object({ petId: z.string().min(1).max(40) }), 'params'),
    async (req, res) => {
      const { petId } = res.locals['params'] as { petId: string };
      res.json({ patient: await service.patient(currentUser(req), petId) });
    },
  );

  return router;
}

/** GET /api/vets – verified veterinarians that owners can book. */
export function vetsRouter(prisma: PrismaClient) {
  const router = Router();
  const service = consultationsService(prisma);
  router.get('/', authenticate(prisma), async (_req, res) => {
    res.json({ vets: await service.bookableVets() });
  });
  return router;
}
