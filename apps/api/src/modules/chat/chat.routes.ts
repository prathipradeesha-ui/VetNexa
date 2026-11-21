import {
  chatMessageSchema,
  type ChatHistoryMessage,
  type ChatMessageData,
  type ChatReply,
} from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import type { ChatMessage, PrismaClient } from '../../generated/prisma/client';
import type { AiClient } from '../../lib/ai-client';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

/** How many earlier messages are returned to rebuild the conversation. */
const HISTORY_LIMIT = 50;

const toHistoryMessage = (row: ChatMessage): ChatHistoryMessage => ({
  id: row.id,
  sender: row.sender,
  content: row.content,
  reply: (row.payload as ChatReply | null) ?? null,
  createdAt: row.createdAt.toISOString(),
});

/**
 * /api/chat – the pet-care assistant.
 *
 *   POST   /          ask a question (anyone; signed-in users' conversations are saved)
 *   GET    /history   my saved conversation, oldest first (signed in)
 *   DELETE /history   delete my saved conversation (signed in)
 *
 * The answer itself comes from the AI service, which applies safety triage before retrieval.
 */
export function chatRouter(prisma: PrismaClient, ai: AiClient, limiter: RequestHandler) {
  const router = Router();

  router.post(
    '/',
    limiter,
    optionalAuthenticate(prisma),
    validate(chatMessageSchema),
    async (req, res) => {
      const { message } = res.locals['body'] as ChatMessageData;
      const reply = await ai.chat(message);

      if (req.user) {
        // Two inserts in one transaction, so a conversation never has a question without answer.
        // Both times come from the same clock so the answer always sorts after its question.
        const askedAt = new Date();
        await prisma.$transaction([
          prisma.chatMessage.create({
            data: { userId: req.user.id, sender: 'USER', content: message, createdAt: askedAt },
          }),
          prisma.chatMessage.create({
            data: {
              userId: req.user.id,
              sender: 'ASSISTANT',
              content: reply.text,
              payload: reply as object,
              createdAt: new Date(askedAt.getTime() + 1),
            },
          }),
        ]);
      }
      res.json({ reply, saved: Boolean(req.user) });
    },
  );

  router.get('/history', authenticate(prisma), async (req, res) => {
    const rows = await prisma.chatMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    res.json({ messages: rows.reverse().map(toHistoryMessage) });
  });

  router.delete('/history', authenticate(prisma), async (req, res) => {
    await prisma.chatMessage.deleteMany({ where: { userId: req.user!.id } });
    res.status(204).end();
  });

  return router;
}
