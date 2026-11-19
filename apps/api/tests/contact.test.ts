import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const message = {
  name: 'Kasun Jayawardena',
  email: 'Kasun@Example.com',
  phone: '0712345678',
  topic: 'CLINIC_LISTING',
  message: 'We run a small clinic in Kandy and would like to be listed on VetNexa.',
};

describe('POST /api/contact', () => {
  it('stores the message and returns a reference', async () => {
    const res = await request(testApp()).post('/api/contact').send(message);

    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^[A-Z0-9]{8}$/);
    const saved = await testPrisma.contactMessage.findFirstOrThrow();
    expect(saved).toMatchObject({
      email: 'kasun@example.com',
      topic: 'CLINIC_LISTING',
      status: 'NEW',
      userId: null,
    });
  });

  it('links the message to the account when the sender is signed in', async () => {
    const user = await createUser('OWNER');
    const agent = await signedInAgent(user.email);

    await agent.post('/api/contact').send(message).expect(201);

    const saved = await testPrisma.contactMessage.findFirstOrThrow();
    expect(saved.userId).toBe(user.id);
  });

  it('rejects incomplete messages with field errors', async () => {
    const res = await request(testApp())
      .post('/api/contact')
      .send({ ...message, message: 'Too short' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('message');
    expect(await testPrisma.contactMessage.count()).toBe(0);
  });

  it('limits each sender to 5 messages per hour', async () => {
    const app = testApp({ rateLimits: true });
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/contact').send(message).expect(201);
    }
    const blocked = await request(app).post('/api/contact').send(message);
    expect(blocked.status).toBe(429);
  });
});
