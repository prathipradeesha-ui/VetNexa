import { healthRecordSchema, type HealthRecordData } from '@vetnexa/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, authorize, currentUser } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { recordsService } from './records.service';

const petParams = z.object({ petId: z.string().min(1).max(40) });
const recordParams = petParams.extend({ recordId: z.string().min(1).max(40) });

/**
 * /api/pets/:petId/records – a pet's health history (OWNER role, own pets only).
 *   GET    /             all records, newest first
 *   POST   /             add a record
 *   PUT    /:recordId    update a record the owner entered
 *   DELETE /:recordId    delete a record the owner entered
 */
export function recordsRouter(prisma: PrismaClient) {
  const router = Router({ mergeParams: true }); // gives access to :petId from the parent path
  const service = recordsService(prisma);
  router.use(authenticate(prisma), authorize('OWNER'));

  router.get('/', validate(petParams, 'params'), async (req, res) => {
    const { petId } = res.locals['params'] as z.infer<typeof petParams>;
    res.json({ records: await service.list(currentUser(req).id, petId) });
  });

  router.post(
    '/',
    validate(petParams, 'params'),
    validate(healthRecordSchema),
    async (req, res) => {
      const { petId } = res.locals['params'] as z.infer<typeof petParams>;
      const data = res.locals['body'] as HealthRecordData;
      res.status(201).json({ record: await service.create(currentUser(req).id, petId, data) });
    },
  );

  router.put(
    '/:recordId',
    validate(recordParams, 'params'),
    validate(healthRecordSchema),
    async (req, res) => {
      const { petId, recordId } = res.locals['params'] as z.infer<typeof recordParams>;
      const data = res.locals['body'] as HealthRecordData;
      res.json({ record: await service.update(currentUser(req).id, petId, recordId, data) });
    },
  );

  router.delete('/:recordId', validate(recordParams, 'params'), async (req, res) => {
    const { petId, recordId } = res.locals['params'] as z.infer<typeof recordParams>;
    await service.remove(currentUser(req).id, petId, recordId);
    res.status(204).end();
  });

  return router;
}

/** GET /api/reminders – upcoming and overdue care items across all of the owner's pets. */
export function remindersRouter(prisma: PrismaClient) {
  const router = Router();
  const service = recordsService(prisma);
  router.get('/', authenticate(prisma), authorize('OWNER'), async (req, res) => {
    res.json({ reminders: await service.reminders(currentUser(req).id) });
  });
  return router;
}
