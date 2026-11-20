import {
  adoptionApplicationSchema,
  adoptionListingSchema,
  AGE_GROUPS,
  applicationDecisionSchema,
  listingStatusSchema,
  SPECIES,
  type AdoptionApplicationData,
  type AdoptionListingData,
  type ApplicationDecisionData,
} from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, authorize, currentUser, optionalAuthenticate } from '../../middleware/auth';
import { singleImage } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { adoptionService, type ListingFilters } from './adoption.service';

const idParams = z.object({ id: z.string().min(1).max(40) });
const browseQuery = z.object({
  species: z.enum(SPECIES).optional(),
  ageGroup: z.enum(AGE_GROUPS).optional(),
  city: z.string().trim().max(80).optional(),
  goodWithChildren: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

/**
 * /api/adoption
 *   GET   /listings                     public browsing with filters
 *   GET   /listings/mine                rescuer's own listings with open application counts
 *   GET   /listings/:id                 public detail (+ my application when signed in)
 *   POST  /listings                     rescuer creates a listing
 *   PUT   /listings/:id                 rescuer updates their listing
 *   PATCH /listings/:id/status          withdraw / make available again
 *   PUT   /listings/:id/photo           listing photo
 *   GET   /listings/:id/applications    rescuer reviews applications
 *   POST  /listings/:id/applications    owner applies (rate limited)
 *   GET   /applications/mine            owner's applications
 *   POST  /applications/:id/withdraw    owner withdraws
 *   PATCH /applications/:id/decision    rescuer: under review / approve / reject
 */
export function adoptionRouter(prisma: PrismaClient, applyLimiter: RequestHandler) {
  const router = Router();
  const service = adoptionService(prisma);
  const idOf = (locals: Record<string, unknown>) => (locals['params'] as { id: string }).id;
  const rescuerOnly = [authenticate(prisma), authorize('RESCUER', 'ADMIN')];
  const ownerOnly = [authenticate(prisma), authorize('OWNER')];

  router.get('/listings', validate(browseQuery, 'query'), async (_req, res) => {
    res.json(await service.browse(res.locals['query'] as ListingFilters));
  });

  router.get('/listings/mine', ...rescuerOnly, async (req, res) => {
    res.json({ listings: await service.mine(currentUser(req)) });
  });

  router.get(
    '/listings/:id',
    validate(idParams, 'params'),
    optionalAuthenticate(prisma),
    async (req, res) => {
      res.json({ listing: await service.detail(idOf(res.locals), req.user) });
    },
  );

  router.post('/listings', ...rescuerOnly, validate(adoptionListingSchema), async (req, res) => {
    const listing = await service.create(
      currentUser(req),
      res.locals['body'] as AdoptionListingData,
    );
    res.status(201).json({ listing });
  });

  router.put(
    '/listings/:id',
    ...rescuerOnly,
    validate(idParams, 'params'),
    validate(adoptionListingSchema),
    async (req, res) => {
      const data = res.locals['body'] as AdoptionListingData;
      res.json({ listing: await service.update(currentUser(req), idOf(res.locals), data) });
    },
  );

  router.patch(
    '/listings/:id/status',
    ...rescuerOnly,
    validate(idParams, 'params'),
    validate(listingStatusSchema),
    async (req, res) => {
      const { status } = res.locals['body'] as z.infer<typeof listingStatusSchema>;
      res.json({ listing: await service.setStatus(currentUser(req), idOf(res.locals), status) });
    },
  );

  router.put(
    '/listings/:id/photo',
    ...rescuerOnly,
    validate(idParams, 'params'),
    singleImage('photo'),
    async (req, res) => {
      res.json({
        listing: await service.setPhoto(currentUser(req), idOf(res.locals), req.file!.buffer),
      });
    },
  );

  router.get(
    '/listings/:id/applications',
    ...rescuerOnly,
    validate(idParams, 'params'),
    async (req, res) => {
      res.json(await service.applicationsFor(currentUser(req), idOf(res.locals)));
    },
  );

  router.post(
    '/listings/:id/applications',
    ...ownerOnly,
    applyLimiter,
    validate(idParams, 'params'),
    validate(adoptionApplicationSchema),
    async (req, res) => {
      const data = res.locals['body'] as AdoptionApplicationData;
      res
        .status(201)
        .json({ application: await service.apply(currentUser(req), idOf(res.locals), data) });
    },
  );

  router.get('/applications/mine', ...ownerOnly, async (req, res) => {
    res.json({ applications: await service.myApplications(currentUser(req)) });
  });

  router.post(
    '/applications/:id/withdraw',
    ...ownerOnly,
    validate(idParams, 'params'),
    async (req, res) => {
      await service.withdraw(currentUser(req), idOf(res.locals));
      res.status(204).end();
    },
  );

  router.patch(
    '/applications/:id/decision',
    ...rescuerOnly,
    validate(idParams, 'params'),
    validate(applicationDecisionSchema),
    async (req, res) => {
      const decision = res.locals['body'] as ApplicationDecisionData;
      res.json(await service.decide(currentUser(req), idOf(res.locals), decision));
    },
  );

  return router;
}
