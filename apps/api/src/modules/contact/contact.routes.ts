import { contactSchema, type ContactData } from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import { validate } from '../../middleware/validate';
import { readSessionToken, SESSION_COOKIE } from '../auth/session';

/**
 * POST /api/contact – saves a message from the public Contact page.
 * Anyone may send one; if the sender is signed in, the message is linked to their account
 * so administrators can see who wrote it. Rate-limited to stop spam.
 */
export function contactRouter(prisma: PrismaClient, contactLimiter: RequestHandler) {
  const router = Router();

  router.post('/', contactLimiter, validate(contactSchema), async (req, res) => {
    const data = res.locals['body'] as ContactData;
    const session = readSessionToken(req.cookies?.[SESSION_COOKIE]);

    const message = await prisma.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        topic: data.topic,
        message: data.message,
        userId: session?.sub ?? null,
      },
      select: { id: true, createdAt: true },
    });

    res.status(201).json({
      message: 'Thank you. Your message has been received and we will reply by email.',
      reference: message.id.slice(-8).toUpperCase(),
    });
  });

  return router;
}
