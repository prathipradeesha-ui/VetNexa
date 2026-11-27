import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAssessment, AiClient } from '../src/lib/ai-client';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const assessed: AiAssessment = {
  status: 'ASSESSED',
  predictedClass: 'puncture_wound',
  confidence: 0.77,
  severity: 'MODERATE',
  referToVet: true,
  escalated: false,
  summary: 'The photo most likely shows a puncture wound, such as a bite.',
  guidance: 'Contact a veterinarian within 24 hours.',
  probabilities: { puncture_wound: 0.77, laceration: 0.23 },
  modelVersion: 'test',
  demoModel: true,
  disclaimer: 'Not a diagnosis.',
  quality: { ok: true, problems: [] },
  symptoms: null,
  triage: null,
  ood: null,
};

function fakeAi(answer: Partial<AiAssessment> = {}) {
  return {
    assess: vi.fn(async () => ({ ...assessed, ...answer })),
    health: vi.fn(),
    chat: vi.fn(),
  } satisfies AiClient;
}

const photo = () =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: '#a86b5c' } })
    .jpeg()
    .toBuffer();

const guestReport = {
  species: 'CAT',
  title: 'Kitten trapped in a drain',
  description: 'A small kitten is crying inside the roadside drain and cannot climb out.',
  locationText: 'Galle Road, opposite the post office',
  city: 'Moratuwa',
  urgency: 'HIGH',
  reporterName: 'Kamal',
  contactPhone: '0771234567',
  latitude: 6.773456,
  longitude: 79.882345,
};

describe('emergency wound check without an account', () => {
  it('assesses a photo with symptom answers and stores nothing', async () => {
    const ai = fakeAi();
    const res = await request(testApp({ aiClient: ai }))
      .post('/api/emergency/assess')
      .field('species', 'CAT')
      .field('answers', JSON.stringify({ cause: 'bite_fight', redFlags: [] }))
      .attach('photo', await photo(), 'bite.jpg')
      .expect(200);

    expect(ai.assess).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      expect.objectContaining({ species: 'cat', cause: 'bite_fight' }),
    );
    expect(res.body.stored).toBe(false);
    expect(res.body.assessment).toMatchObject({
      species: 'CAT',
      severity: 'MODERATE',
      referToVet: true,
      answers: expect.objectContaining({ cause: 'bite_fight' }),
    });
    // Without triage details from the AI service, the outcome follows the severity.
    expect(res.body.assessment).toMatchObject({
      triage: 'CONSULT',
      triageDetails: null,
      skinCheck: null,
    });
    expect(res.body.assessment).not.toHaveProperty('imageUrl');
    expect(await testPrisma.woundAssessment.count()).toBe(0);
  });

  it('accepts only dogs and cats and requires a photo', async () => {
    const app = testApp({ aiClient: fakeAi() });
    const bird = await request(app)
      .post('/api/emergency/assess')
      .field('species', 'BIRD')
      .attach('photo', await photo(), 'bird.jpg')
      .expect(422);
    expect(bird.body.error.details[0].field).toBe('species');
    await request(app).post('/api/emergency/assess').field('species', 'DOG').expect(422);
  });

  it('asks for a better photo when the quality check fails', async () => {
    const ai = fakeAi({
      status: 'REJECTED_QUALITY',
      predictedClass: null,
      confidence: null,
      quality: { ok: false, problems: ['The photo is blurry.'] },
    });
    const res = await request(testApp({ aiClient: ai }))
      .post('/api/emergency/assess')
      .field('species', 'DOG')
      .attach('photo', await photo(), 'blurry.jpg')
      .expect(422);
    expect(res.body.error).toMatchObject({ code: 'PHOTO_QUALITY' });
  });
});

describe('emergency rescue report without an account', () => {
  it('creates a report that rescuers can see, with the guest name and phone', async () => {
    const res = await request(testApp())
      .post('/api/emergency/rescue')
      .send(guestReport)
      .expect(201);
    expect(res.body.report.reference).toMatch(/^[A-Z0-9]{8}$/);

    const rescuer = await createUser('RESCUER');
    const board = (await (await signedInAgent(rescuer.email)).get('/api/rescue').expect(200)).body
      .reports;
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({
      title: 'Kitten trapped in a drain',
      reporter: { name: 'Kamal (no account)', phone: '0771234567', isGuest: true, isMe: false },
    });
  });

  it('requires a name and a phone so rescuers can call back', async () => {
    const { reporterName: _name, contactPhone: _phone, ...withoutContact } = guestReport;
    const res = await request(testApp()).post('/api/emergency/rescue').send(withoutContact);
    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['reporterName', 'contactPhone']));
  });

  it('rejects positions outside Sri Lanka', async () => {
    const res = await request(testApp())
      .post('/api/emergency/rescue')
      .send({ ...guestReport, latitude: 51.5, longitude: -0.12 })
      .expect(422);
    expect(res.body.error.details[0].field).toBe('latitude');
  });
});

describe('rescue location privacy', () => {
  it('shows the exact spot only to the reporter, the assigned rescuer and admins', async () => {
    const owner = await createUser('OWNER');
    const reporter = await signedInAgent(owner.email);
    const created = await reporter
      .post('/api/rescue')
      .send({ ...guestReport, reporterName: undefined })
      .expect(201);
    const id = created.body.report.id;
    expect(created.body.report).toMatchObject({
      latitude: 6.773456,
      longitude: 79.882345,
      locationApproximate: false,
    });

    const rescuerUser = await createUser('RESCUER');
    const rescuer = await signedInAgent(rescuerUser.email);
    const before = (await rescuer.get(`/api/rescue/${id}`).expect(200)).body.report;
    expect(before).toMatchObject({ latitude: 6.77, longitude: 79.88, locationApproximate: true });

    await rescuer.post(`/api/rescue/${id}/take-on`).expect(200);
    const after = (await rescuer.get(`/api/rescue/${id}`).expect(200)).body.report;
    expect(after).toMatchObject({ latitude: 6.773456, locationApproximate: false });

    const admin = await signedInAgent((await createUser('ADMIN')).email);
    expect((await admin.get(`/api/rescue/${id}`).expect(200)).body.report.latitude).toBe(6.773456);
  });
});
