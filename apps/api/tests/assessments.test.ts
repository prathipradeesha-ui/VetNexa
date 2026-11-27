import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { httpAiClient, type AiAssessment, type AiClient } from '../src/lib/ai-client';
import { HttpError } from '../src/lib/http-error';
import { createUser, resetDatabase, signedInAgent, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const assessed: AiAssessment = {
  status: 'ASSESSED',
  predictedClass: 'laceration',
  confidence: 0.8125,
  severity: 'MODERATE',
  referToVet: true,
  escalated: false,
  summary: 'The photo most likely shows a cut (laceration).',
  guidance: 'Contact a veterinarian within 24 hours.',
  probabilities: {
    abrasion: 0.1,
    laceration: 0.8125,
    puncture_wound: 0.05,
    abscess_or_infection: 0.0275,
    healthy_skin: 0.01,
  },
  modelVersion: 'wound-resnet18-test',
  demoModel: true,
  disclaimer: 'Not a diagnosis.',
  quality: { ok: true, problems: [] },
  symptoms: null,
  triage: {
    outcome: 'CONSULT',
    label: 'Veterinary consultation recommended',
    combinedRisk: 0.45,
    reliability: 0.82,
    inputs: [
      {
        source: 'image',
        risk: 0.45,
        level: 'CONSULT',
        reliability: 0.82,
        weight: 1,
        notes: [],
        quality: 1,
        familiarity: 0.9,
        certainty: 0.7,
        topClass: 'laceration',
      },
    ],
    overrides: [],
    fusion: 'reliability',
  },
  ood: { familiarity: 0.9, outOfDistribution: false },
  skinCheck: {
    status: 'SUGGESTED',
    condition: 'dermatitis',
    label: 'Inflamed or allergic skin (dermatitis, allergy, bacterial, hot spot)',
    confidence: 0.71,
    advice: 'Ask a vet for advice.',
    probabilities: {
      healthy: 0.1,
      ringworm: 0.05,
      mange: 0.08,
      fungal_infection: 0.06,
      dermatitis: 0.71,
    },
    modelVersion: 'skin-efficientnetb0-test',
  },
};

/** A fake AI service that returns the given answer and records what it was sent. */
function fakeAi(answer: Partial<AiAssessment> = {}, modelLoaded = true) {
  return {
    assess: vi.fn(async () => ({ ...assessed, ...answer })),
    health: vi.fn(async () => ({
      modelLoaded,
      modelVersion: 'wound-resnet18-test',
      demoModel: true,
    })),
    chat: vi.fn(async () => {
      throw new Error('not used in these tests');
    }),
  } satisfies AiClient;
}

const photo = () =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: '#a86b5c' } })
    .jpeg()
    .toBuffer();

async function ownerWithPet(species: 'DOG' | 'CAT' = 'DOG', ai: AiClient = fakeAi()) {
  const owner = await createUser('OWNER');
  const pet = await testPrisma.pet.create({ data: { ownerId: owner.id, name: 'Bruno', species } });
  return { owner, pet, agent: await signedInAgent(owner.email, { aiClient: ai }) };
}

const uploadPath = (url: string) =>
  path.join(process.env['UPLOAD_DIR']!, url.replace('/uploads/', ''));

describe('AI wound assessments', () => {
  it('sends the questionnaire with the pet species and stores answers and evidence', async () => {
    const evidence = {
      species: 'cat',
      redFlags: [],
      risk: 0.35,
      level: 'consult',
      rules: [{ id: 'bite', weight: 0.35, reason: 'Bite wounds often become infected.' }],
      completeness: 2 / 7,
      missing: ['bodyLocation', 'signs', 'appetite', 'energy', 'pain'],
      questionnaireVersion: 'test',
    };
    const ai = fakeAi({ symptoms: evidence as never });
    const { agent, pet } = await ownerWithPet('CAT', ai);

    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .field('answers', JSON.stringify({ cause: 'bite_fight', duration: '1_3_days' }))
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);

    expect(ai.assess).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      expect.objectContaining({ species: 'cat', cause: 'bite_fight', signs: null, redFlags: [] }),
    );
    expect(res.body.assessment.answers).toMatchObject({ cause: 'bite_fight', pain: null });
    expect(res.body.assessment.symptoms).toEqual(evidence);
    const stored = await agent.get(`/api/assessments/${res.body.assessment.id}`).expect(200);
    expect(stored.body.assessment.symptoms.level).toBe('consult');
  });

  it('rejects unreadable or unknown questionnaire answers', async () => {
    const ai = fakeAi();
    const { agent, pet } = await ownerWithPet('DOG', ai);
    for (const answers of ['{not json', JSON.stringify({ duration: 'forever' })]) {
      const res = await agent
        .post('/api/assessments')
        .field('petId', pet.id)
        .field('answers', answers)
        .attach('photo', await photo(), 'wound.jpg')
        .expect(422);
      expect(res.body.error.details[0].field).toMatch(/^answers/);
    }
    expect(ai.assess).not.toHaveBeenCalled();
  });

  it('still works without a questionnaire (missing input)', async () => {
    const ai = fakeAi();
    const { agent, pet } = await ownerWithPet('DOG', ai);
    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);
    expect(ai.assess).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', undefined);
    expect(res.body.assessment).toMatchObject({ answers: null, symptoms: null });
  });

  it('assesses a photo, stores the result and the photo, and lists it', async () => {
    const ai = fakeAi();
    const { agent, pet } = await ownerWithPet('DOG', ai);

    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .field('ownerNotes', 'Cut on the paw after a walk')
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);

    expect(ai.assess).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', undefined);
    expect(res.body.assessment).toMatchObject({
      pet: { id: pet.id, name: 'Bruno' },
      status: 'ASSESSED',
      predictedClass: 'laceration',
      confidence: 0.8125,
      severity: 'MODERATE',
      referToVet: true,
      demoModel: true,
      ownerNotes: 'Cut on the paw after a walk',
    });
    expect(res.body.assessment.triage).toBe('CONSULT');
    expect(res.body.assessment.triageDetails.inputs[0].source).toBe('image');
    expect(res.body.assessment.skinCheck).toMatchObject({
      status: 'SUGGESTED',
      condition: 'dermatitis',
    });
    expect(res.body.assessment.disclaimer).toMatch(/not a diagnosis/i);
    expect(res.body.assessment.imageUrl).toMatch(/^\/uploads\/wounds\/[a-f0-9]{32}\.webp$/);
    expect(existsSync(uploadPath(res.body.assessment.imageUrl))).toBe(true);

    const list = await agent.get(`/api/assessments?petId=${pet.id}`).expect(200);
    expect(list.body.assessments).toHaveLength(1);
    const saved = await agent.get(`/api/assessments/${res.body.assessment.id}`).expect(200);
    expect(saved.body.assessment.skinCheck.condition).toBe('dermatitis');
  });

  it('stores uncertain results, which always refer to a vet', async () => {
    const { agent, pet } = await ownerWithPet(
      'CAT',
      fakeAi({ status: 'UNCERTAIN', severity: 'UNCERTAIN', confidence: 0.41 }),
    );
    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);
    expect(res.body.assessment).toMatchObject({ status: 'UNCERTAIN', severity: 'UNCERTAIN' });
  });

  it('rejects a poor photo with advice and stores nothing', async () => {
    const { agent, pet } = await ownerWithPet(
      'DOG',
      fakeAi({
        status: 'REJECTED_QUALITY',
        predictedClass: null,
        confidence: null,
        quality: { ok: false, problems: ['The photo is too dark.'] },
      }),
    );
    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .attach('photo', await photo(), 'dark.jpg')
      .expect(422);
    expect(res.body.error).toMatchObject({
      code: 'PHOTO_QUALITY',
      details: { problems: ['The photo is too dark.'] },
    });
    expect(await testPrisma.woundAssessment.count()).toBe(0);
  });

  it("cannot assess, view or delete another owner's records", async () => {
    const ai = fakeAi();
    const first = await ownerWithPet('DOG', ai);
    const created = await first.agent
      .post('/api/assessments')
      .field('petId', first.pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);

    const other = await ownerWithPet('DOG', ai);
    await other.agent
      .post('/api/assessments')
      .field('petId', first.pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(404);
    await other.agent.get(`/api/assessments/${created.body.assessment.id}`).expect(404);
    await other.agent.delete(`/api/assessments/${created.body.assessment.id}`).expect(404);
    expect((await other.agent.get('/api/assessments').expect(200)).body.assessments).toEqual([]);
  });

  it('deletes an assessment together with its photo', async () => {
    const { agent, pet } = await ownerWithPet();
    const created = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);
    const { id, imageUrl } = created.body.assessment;
    await agent.delete(`/api/assessments/${id}`).expect(204);
    expect(existsSync(uploadPath(imageUrl))).toBe(false);
    await agent.get(`/api/assessments/${id}`).expect(404);
  });

  it('requires a photo and a pet', async () => {
    const { agent, pet } = await ownerWithPet();
    await agent.post('/api/assessments').field('petId', pet.id).expect(422);
    const res = await agent
      .post('/api/assessments')
      .attach('photo', await photo(), 'wound.jpg')
      .expect(422);
    expect(res.body.error.details[0].field).toBe('petId');
  });

  it('is only for signed-in pet owners', async () => {
    const vet = await createUser('VET', { verifiedVet: true });
    const agent = await signedInAgent(vet.email, { aiClient: fakeAi() });
    await agent.get('/api/assessments').expect(403);
  });

  it('reports whether the AI service is available', async () => {
    const up = await ownerWithPet('DOG', fakeAi());
    expect((await up.agent.get('/api/assessments/status').expect(200)).body).toEqual({
      available: true,
      demoModel: true,
      modelVersion: 'wound-resnet18-test',
    });

    const down: AiClient = {
      assess: async () => {
        throw HttpError.serviceUnavailable();
      },
      health: async () => {
        throw HttpError.serviceUnavailable();
      },
      chat: async () => {
        throw HttpError.serviceUnavailable();
      },
    };
    const off = await ownerWithPet('DOG', down);
    expect((await off.agent.get('/api/assessments/status').expect(200)).body.available).toBe(false);
    const res = await off.agent
      .post('/api/assessments')
      .field('petId', off.pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('HTTP AI client', () => {
  let server: Server | undefined;
  afterAll(() => server?.close());

  async function serve(handler: Parameters<typeof createServer>[1]) {
    server?.close();
    server = createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('sends the photo and answers as a form, with the service token', async () => {
    let token: string | undefined;
    let form: FormData | undefined;
    const url = await serve((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        token = req.headers['x-service-token'] as string;
        // Parse the multipart body the same way a server framework would.
        form = await new Response(Buffer.concat(chunks), {
          headers: { 'content-type': req.headers['content-type']! },
        }).formData();
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(assessed));
      });
    });
    const answers = { species: 'dog', redFlags: ['collapse'] };
    const result = await httpAiClient(url, 'secret', 2000).assess(
      Buffer.alloc(10),
      'image/png',
      answers,
    );
    expect(result.predictedClass).toBe('laceration');
    expect(token).toBe('secret');
    const image = form!.get('image') as File;
    expect(image.type).toBe('image/png');
    expect(image.size).toBe(10);
    expect(JSON.parse(String(form!.get('answers')))).toEqual(answers);
  });

  it('turns an unreachable service into a 503', async () => {
    const client = httpAiClient('http://127.0.0.1:9', undefined, 1000);
    await expect(client.health()).rejects.toMatchObject({ status: 503 });
  });

  it('turns a model-unavailable answer into a 503', async () => {
    const url = await serve((_req, res) => {
      res.statusCode = 503;
      res.end('{}');
    });
    await expect(httpAiClient(url).assess(Buffer.alloc(1), 'image/jpeg')).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe('wound follow-up check-ins', () => {
  async function checkedWound() {
    const { agent, pet, owner } = await ownerWithPet();
    const res = await agent
      .post('/api/assessments')
      .field('petId', pet.id)
      .attach('photo', await photo(), 'wound.jpg')
      .expect(201);
    return { agent, pet, owner, assessmentId: res.body.assessment.id as string };
  }

  it('plans a follow-up, shows it on the result and records how the wound looks', async () => {
    const { agent, assessmentId } = await checkedWound();
    const before = Date.now();

    const created = await agent
      .post(`/api/assessments/${assessmentId}/follow-ups`)
      .send({ inDays: 2 })
      .expect(201);
    const due = new Date(created.body.followUp.dueAt).getTime();
    expect(due - before).toBeGreaterThanOrEqual(2 * 24 * 3600 * 1000 - 1000);
    expect(due - before).toBeLessThan(2 * 24 * 3600 * 1000 + 60_000);
    expect(created.body.followUp).toMatchObject({ progress: null, pet: { name: 'Bruno' } });

    // Only one open follow-up per check.
    await agent.post(`/api/assessments/${assessmentId}/follow-ups`).send({ inDays: 1 }).expect(409);

    const result = await agent.get(`/api/assessments/${assessmentId}`).expect(200);
    expect(result.body.assessment.followUps).toHaveLength(1);

    const done = await agent
      .patch(`/api/assessments/follow-ups/${created.body.followUp.id}`)
      .send({ progress: 'WORSE', note: 'More swollen today' })
      .expect(200);
    expect(done.body.followUp).toMatchObject({ progress: 'WORSE', note: 'More swollen today' });
    expect(done.body.followUp.completedAt).not.toBeNull();

    await agent
      .patch(`/api/assessments/follow-ups/${created.body.followUp.id}`)
      .send({ progress: 'BETTER' })
      .expect(409);

    // Once answered, a new follow-up can be planned; open ones are listed first.
    await agent.post(`/api/assessments/${assessmentId}/follow-ups`).send({ inDays: 7 }).expect(201);
    const list = await agent.get('/api/assessments/follow-ups').expect(200);
    expect(list.body.followUps.map((f: { progress: string | null }) => f.progress)).toEqual([
      null,
      'WORSE',
    ]);
  });

  it('accepts only the offered days and a known progress answer', async () => {
    const { agent, assessmentId } = await checkedWound();
    await agent
      .post(`/api/assessments/${assessmentId}/follow-ups`)
      .send({ inDays: 30 })
      .expect(422);
    const { body } = await agent
      .post(`/api/assessments/${assessmentId}/follow-ups`)
      .send({ inDays: 1 })
      .expect(201);
    await agent
      .patch(`/api/assessments/follow-ups/${body.followUp.id}`)
      .send({ progress: 'HEALED' })
      .expect(422);
  });

  it("keeps follow-ups private to the pet's owner", async () => {
    const { agent, assessmentId } = await checkedWound();
    const { body } = await agent
      .post(`/api/assessments/${assessmentId}/follow-ups`)
      .send({ inDays: 3 })
      .expect(201);

    const other = await signedInAgent((await createUser('OWNER')).email, { aiClient: fakeAi() });
    await other.post(`/api/assessments/${assessmentId}/follow-ups`).send({ inDays: 1 }).expect(404);
    await other
      .patch(`/api/assessments/follow-ups/${body.followUp.id}`)
      .send({ progress: 'BETTER' })
      .expect(404);
    await other.delete(`/api/assessments/follow-ups/${body.followUp.id}`).expect(404);
    expect((await other.get('/api/assessments/follow-ups').expect(200)).body.followUps).toEqual([]);

    await agent.delete(`/api/assessments/follow-ups/${body.followUp.id}`).expect(204);
    expect(await testPrisma.woundFollowUp.count()).toBe(0);
  });
});
