import { rescueReportSchema, rescueStatusSchema, type RescueReportData } from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, authorize, currentUser } from '../../middleware/auth';
import { singleImage } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { rescueService, type RescueView } from './rescue.service';

const idParams = z.object({ id: z.string().min(1).max(40) });
const listQuery = z.object({
  view: z.enum(['open', 'mine', 'resolved']).default('open'),
  city: z.string().trim().max(80).optional(),
});

/**
 * /api/rescue – reports of animals that need help.
 *   GET   /              rescue board (rescuers, admins) or my reports (everyone else)
 *   POST  /              report an animal (any signed-in user; rate limited)
 *   GET   /:id           one report
 *   POST  /:id/take-on   rescuer takes responsibility for an open report
 *   PATCH /:id/status    mark rescued or closed
 *   PUT   /:id/photo     reporter adds a photo
 */
export function rescueRouter(prisma: PrismaClient, reportLimiter: RequestHandler) {
  const router = Router();
  const service = rescueService(prisma);
  const idOf = (locals: Record<string, unknown>) => (locals['params'] as { id: string }).id;
  router.use(authenticate(prisma));

  router.get('/', validate(listQuery, 'query'), async (req, res) => {
    const { view, city } = res.locals['query'] as { view: RescueView; city?: string };
    res.json({ reports: await service.list(currentUser(req), view, city) });
  });

  router.post('/', reportLimiter, validate(rescueReportSchema), async (req, res) => {
    const report = await service.create(currentUser(req), res.locals['body'] as RescueReportData);
    res.status(201).json({ report });
  });

  router.get('/:id', validate(idParams, 'params'), async (req, res) => {
    res.json({ report: await service.get(currentUser(req), idOf(res.locals)) });
  });

  router.post(
    '/:id/take-on',
    authorize('RESCUER'),
    validate(idParams, 'params'),
    async (req, res) => {
      res.json({ report: await service.takeOn(currentUser(req), idOf(res.locals)) });
    },
  );

  router.patch(
    '/:id/status',
    validate(idParams, 'params'),
    validate(rescueStatusSchema),
    async (req, res) => {
      const { status } = res.locals['body'] as z.infer<typeof rescueStatusSchema>;
      res.json({ report: await service.setStatus(currentUser(req), idOf(res.locals), status) });
    },
  );

  router.put('/:id/photo', validate(idParams, 'params'), singleImage('photo'), async (req, res) => {
    res.json({
      report: await service.setPhoto(currentUser(req), idOf(res.locals), req.file!.buffer),
    });
  });

  return router;
}
