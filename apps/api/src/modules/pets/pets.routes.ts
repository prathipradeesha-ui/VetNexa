import { petSchema, type PetData } from '@vetnexa/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client';
import { authenticate, authorize, currentUser } from '../../middleware/auth';
import { singleImage } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { petsService } from './pets.service';

const petIdParams = z.object({ petId: z.string().min(1).max(40) });

/**
 * /api/pets – a pet owner's own pets. Every route requires the OWNER role, and every
 * query is filtered by the signed-in owner's ID.
 *
 *   GET    /                list my pets (with record count and next due item)
 *   POST   /                add a pet
 *   GET    /:petId          one pet
 *   PUT    /:petId          update a pet
 *   DELETE /:petId          delete a pet and its records
 *   PUT    /:petId/photo    upload or replace the photo (multipart field "photo")
 *   DELETE /:petId/photo    remove the photo
 */
export function petsRouter(prisma: PrismaClient) {
  const router = Router();
  const service = petsService(prisma);
  router.use(authenticate(prisma), authorize('OWNER'));

  const petId = (locals: Record<string, unknown>) =>
    (locals['params'] as z.infer<typeof petIdParams>).petId;

  router.get('/', async (req, res) => {
    res.json({ pets: await service.list(currentUser(req).id) });
  });

  router.post('/', validate(petSchema), async (req, res) => {
    const pet = await service.create(currentUser(req).id, res.locals['body'] as PetData);
    res.status(201).json({ pet });
  });

  router.get('/:petId', validate(petIdParams, 'params'), async (req, res) => {
    res.json({ pet: await service.get(currentUser(req).id, petId(res.locals)) });
  });

  router.put('/:petId', validate(petIdParams, 'params'), validate(petSchema), async (req, res) => {
    const data = res.locals['body'] as PetData;
    res.json({ pet: await service.update(currentUser(req).id, petId(res.locals), data) });
  });

  router.delete('/:petId', validate(petIdParams, 'params'), async (req, res) => {
    await service.remove(currentUser(req).id, petId(res.locals));
    res.status(204).end();
  });

  router.put(
    '/:petId/photo',
    validate(petIdParams, 'params'),
    singleImage('photo'),
    async (req, res) => {
      const pet = await service.setPhoto(currentUser(req).id, petId(res.locals), req.file!.buffer);
      res.json({ pet });
    },
  );

  router.delete('/:petId/photo', validate(petIdParams, 'params'), async (req, res) => {
    res.json({ pet: await service.removePhoto(currentUser(req).id, petId(res.locals)) });
  });

  return router;
}
