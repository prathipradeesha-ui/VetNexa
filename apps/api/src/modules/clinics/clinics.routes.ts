import {
  clinicSearchSchema,
  reviewSchema,
  type ClinicSearch,
  type ReviewData,
} from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, currentUser, optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { clinicsService } from './clinics.service';

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,140}$/) });

/**
 * /api/clinics – public clinic directory and reviews.
 *   GET    /                       search (q, city, service, emergency, openNow, sort)
 *   GET    /:slug                  clinic details, vets, rating breakdown and reviews
 *   PUT    /:slug/reviews/mine     write or update my review (owners and rescuers)
 *   DELETE /:slug/reviews/mine     delete my review
 */
export function clinicsRouter(prisma: PrismaClient, reviewLimiter: RequestHandler) {
  const router = Router();
  const service = clinicsService(prisma);
  const slugOf = (locals: Record<string, unknown>) =>
    (locals['params'] as z.infer<typeof slugParams>).slug;

  router.get('/', validate(clinicSearchSchema, 'query'), async (_req, res) => {
    res.json(await service.search(res.locals['query'] as ClinicSearch));
  });

  router.get(
    '/:slug',
    validate(slugParams, 'params'),
    optionalAuthenticate(prisma),
    async (req, res) => {
      res.json({ clinic: await service.detail(slugOf(res.locals), req.user?.id) });
    },
  );

  router.put(
    '/:slug/reviews/mine',
    reviewLimiter,
    authenticate(prisma),
    validate(slugParams, 'params'),
    validate(reviewSchema),
    async (req, res) => {
      const review = await service.saveReview(
        currentUser(req),
        slugOf(res.locals),
        res.locals['body'] as ReviewData,
      );
      res.json({ review });
    },
  );

  router.delete(
    '/:slug/reviews/mine',
    authenticate(prisma),
    validate(slugParams, 'params'),
    async (req, res) => {
      await service.deleteMyReview(currentUser(req).id, slugOf(res.locals));
      res.status(204).end();
    },
  );

  return router;
}
