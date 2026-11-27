import {
  assessmentRequestSchema,
  followUpCreateSchema,
  followUpUpdateSchema,
  type AssessmentRequest,
  type FollowUpCreate,
  type FollowUpUpdate,
} from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import type { AiClient } from '../../lib/ai-client';
import { authenticate, authorize, currentUser } from '../../middleware/auth';
import { singleImage } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { assessmentsService } from './assessments.service';

const idParams = z.object({ id: z.string().min(1).max(40) });
const listQuery = z.object({ petId: z.string().min(1).max(40).optional() });

/**
 * /api/assessments – AI wound assessment for a pet owner's own dogs and cats.
 *
 *   GET    /status    whether the AI service and a model are available
 *   GET    /          my assessments, newest first (?petId= to filter)
 *   POST   /          assess a photo (multipart: "photo", "petId", optional "ownerNotes")
 *   GET    /:id       one assessment
 *   DELETE /:id       delete an assessment and its photo
 *
 * Follow-up check-ins after a wound check:
 *   GET    /follow-ups              my follow-ups, open ones first
 *   POST   /:id/follow-ups          plan a look again in 1, 2, 3 or 7 days ({ inDays })
 *   PATCH  /follow-ups/:id          record how it looks now ({ progress, note })
 *   DELETE /follow-ups/:id          cancel a follow-up
 */
export function assessmentsRouter(prisma: PrismaClient, ai: AiClient, limiter: RequestHandler) {
  const router = Router();
  const service = assessmentsService(prisma, ai);
  router.use(authenticate(prisma), authorize('OWNER'));

  const id = (locals: Record<string, unknown>) => (locals['params'] as z.infer<typeof idParams>).id;

  router.get('/status', async (_req, res) => {
    res.json(await service.status());
  });

  router.get('/', validate(listQuery, 'query'), async (req, res) => {
    const { petId } = res.locals['query'] as z.infer<typeof listQuery>;
    res.json({ assessments: await service.list(currentUser(req).id, petId) });
  });

  // The photo is parsed first: multipart text fields only exist after multer has run.
  router.post(
    '/',
    limiter,
    singleImage('photo'),
    validate(assessmentRequestSchema),
    async (req, res) => {
      const assessment = await service.create(
        currentUser(req).id,
        res.locals['body'] as AssessmentRequest,
        req.file!,
      );
      res.status(201).json({ assessment });
    },
  );

  // Follow-up routes come before "/:id" so "follow-ups" is not read as an assessment id.
  router.get('/follow-ups', async (req, res) => {
    res.json({ followUps: await service.listFollowUps(currentUser(req).id) });
  });

  router.patch(
    '/follow-ups/:id',
    validate(idParams, 'params'),
    validate(followUpUpdateSchema),
    async (req, res) => {
      const followUp = await service.completeFollowUp(
        currentUser(req).id,
        id(res.locals),
        res.locals['body'] as FollowUpUpdate,
      );
      res.json({ followUp });
    },
  );

  router.delete('/follow-ups/:id', validate(idParams, 'params'), async (req, res) => {
    await service.removeFollowUp(currentUser(req).id, id(res.locals));
    res.status(204).end();
  });

  router.post(
    '/:id/follow-ups',
    validate(idParams, 'params'),
    validate(followUpCreateSchema),
    async (req, res) => {
      const followUp = await service.createFollowUp(
        currentUser(req).id,
        id(res.locals),
        res.locals['body'] as FollowUpCreate,
      );
      res.status(201).json({ followUp });
    },
  );

  router.get('/:id', validate(idParams, 'params'), async (req, res) => {
    res.json({ assessment: await service.get(currentUser(req).id, id(res.locals)) });
  });

  router.delete('/:id', validate(idParams, 'params'), async (req, res) => {
    await service.remove(currentUser(req).id, id(res.locals));
    res.status(204).end();
  });

  return router;
}
