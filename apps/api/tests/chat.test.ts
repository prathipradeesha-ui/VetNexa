import type { ChatReply } from '@vetnexa/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiClient } from '../src/lib/ai-client';
import { HttpError } from '../src/lib/http-error';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const answer: ChatReply = {
  kind: 'answer',
  text: 'Deworming dogs and cats: Intestinal worms are very common…',
  emergency: null,
  article: {
    id: 'deworming',
    title: 'Deworming dogs and cats',
    category: 'Prevention',
    urgency: 'routine',
    species: ['dog', 'cat'],
    summary: 'Intestinal worms are very common…',
    sections: [{ heading: 'Typical schedule', text: '', items: ['Adults: every 3 months.'] }],
    sources: ['ESCCAP guidelines'],
  },
  related: [],
  suggestions: [],
  actions: [{ label: 'Find a clinic', href: '/clinics' }],
  score: 0.31,
  disclaimer: 'General information only, not veterinary advice.',
};

function fakeAi(reply: ChatReply = answer): AiClient & { chat: ReturnType<typeof vi.fn> } {
  return {
    assess: vi.fn(),
    health: vi.fn(),
    chat: vi.fn(async () => reply),
  };
}

describe('pet-care assistant', () => {
  it('answers visitors without storing anything', async () => {
    const ai = fakeAi();
    const res = await request(testApp({ aiClient: ai }))
      .post('/api/chat')
      .send({ message: '  How often should I deworm my dog?  ' })
      .expect(200);

    expect(ai.chat).toHaveBeenCalledWith('How often should I deworm my dog?');
    expect(res.body).toEqual({ reply: answer, saved: false });
    expect(await testPrisma.chatMessage.count()).toBe(0);
  });

  it("saves a signed-in user's conversation and returns it in order", async () => {
    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email, { aiClient: fakeAi() });

    const res = await agent.post('/api/chat').send({ message: 'Deworming?' }).expect(200);
    expect(res.body.saved).toBe(true);
    await agent.post('/api/chat').send({ message: 'And for kittens?' }).expect(200);

    const history = await agent.get('/api/chat/history').expect(200);
    expect(history.body.messages.map((m: { sender: string }) => m.sender)).toEqual([
      'USER',
      'ASSISTANT',
      'USER',
      'ASSISTANT',
    ]);
    expect(history.body.messages[0]).toMatchObject({ content: 'Deworming?', reply: null });
    expect(history.body.messages[1].reply).toEqual(answer);
  });

  it('keeps conversations private and lets users delete theirs', async () => {
    const first = await createUser('OWNER');
    const firstAgent = await signedInAgent(first.email, { aiClient: fakeAi() });
    await firstAgent.post('/api/chat').send({ message: 'Hello' }).expect(200);

    const second = await createUser('RESCUER');
    const secondAgent = await signedInAgent(second.email, { aiClient: fakeAi() });
    expect((await secondAgent.get('/api/chat/history').expect(200)).body.messages).toEqual([]);

    await firstAgent.delete('/api/chat/history').expect(204);
    expect((await firstAgent.get('/api/chat/history').expect(200)).body.messages).toEqual([]);
  });

  it('requires sign-in for history', async () => {
    await request(testApp({ aiClient: fakeAi() }))
      .get('/api/chat/history')
      .expect(401);
  });

  it('validates the question', async () => {
    const app = testApp({ aiClient: fakeAi() });
    await request(app).post('/api/chat').send({ message: '   ' }).expect(422);
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'x'.repeat(501) })
      .expect(422);
    expect(res.body.error.details[0].field).toBe('message');
  });

  it('reports an unavailable assistant with a safety message and stores nothing', async () => {
    const ai: AiClient = {
      assess: vi.fn(),
      health: vi.fn(),
      chat: async () => {
        throw HttpError.serviceUnavailable('The pet-care assistant is not available right now.');
      },
    };
    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email, { aiClient: ai });
    const res = await agent.post('/api/chat').send({ message: 'Hello' }).expect(503);
    expect(res.body.error.message).toMatch(/not available/);
    expect(await testPrisma.chatMessage.count()).toBe(0);
  });
});
