import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const bruno = {
  name: 'Bruno',
  species: 'DOG',
  breed: 'Labrador Retriever',
  sex: 'MALE',
  dateOfBirth: '2022-08-15',
  weightKg: 31.4,
  microchipId: '900164000123456',
  isNeutered: true,
};

/** A real 1200×900 JPEG generated in memory, with a GPS-like EXIF block. */
async function sampleJpeg() {
  return sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 10, g: 108, b: 108 } },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'test', Artist: 'Phone camera' } } })
    .toBuffer();
}

async function ownerWithAgent() {
  const owner = await createUser('OWNER');
  return { owner, agent: await signedInAgent(owner.email) };
}

const uploadPath = (url: string) =>
  path.join(process.env['UPLOAD_DIR']!, url.replace('/uploads/', ''));

describe('pet profiles', () => {
  it('creates, lists, updates and deletes a pet', async () => {
    const { agent } = await ownerWithAgent();

    const created = await agent.post('/api/pets').send(bruno).expect(201);
    expect(created.body.pet).toMatchObject({
      name: 'Bruno',
      weightKg: 31.4,
      dateOfBirth: '2022-08-15',
      photoUrl: null,
    });
    const id = created.body.pet.id;

    const list = await agent.get('/api/pets').expect(200);
    expect(list.body.pets).toHaveLength(1);
    expect(list.body.pets[0]).toMatchObject({ id, recordCount: 0, nextDue: null });

    const updated = await agent
      .put(`/api/pets/${id}`)
      .send({ ...bruno, weightKg: '32.1', notes: 'Allergic to chicken' })
      .expect(200);
    expect(updated.body.pet).toMatchObject({ weightKg: 32.1, notes: 'Allergic to chicken' });

    await agent.delete(`/api/pets/${id}`).expect(204);
    await agent.get(`/api/pets/${id}`).expect(404);
  });

  it('shows the next upcoming health item on the pet card', async () => {
    const { owner, agent } = await ownerWithAgent();
    const pet = await testPrisma.pet.create({
      data: { ownerId: owner.id, name: 'Luna', species: 'CAT' },
    });
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);
    await testPrisma.healthRecord.createMany({
      data: [
        {
          petId: pet.id,
          type: 'VACCINATION',
          title: 'Old rabies',
          recordDate: inDays(-400),
          nextDueDate: inDays(-30),
        },
        {
          petId: pet.id,
          type: 'MEDICATION',
          title: 'Deworming',
          recordDate: inDays(-80),
          nextDueDate: inDays(40),
        },
        {
          petId: pet.id,
          type: 'VACCINATION',
          title: 'FVRCP booster',
          recordDate: inDays(-355),
          nextDueDate: inDays(10),
        },
      ],
    });

    const res = await agent.get('/api/pets').expect(200);

    expect(res.body.pets[0].recordCount).toBe(3);
    expect(res.body.pets[0].nextDue).toMatchObject({ title: 'FVRCP booster', type: 'VACCINATION' });
  });

  it('returns field errors for invalid data', async () => {
    const { agent } = await ownerWithAgent();

    const res = await agent
      .post('/api/pets')
      .send({ ...bruno, name: '', dateOfBirth: '2999-01-01' })
      .expect(422);

    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'dateOfBirth']));
  });

  it('rejects a microchip number already registered to another pet', async () => {
    const { agent } = await ownerWithAgent();
    await agent.post('/api/pets').send(bruno).expect(201);

    const res = await agent
      .post('/api/pets')
      .send({ ...bruno, name: 'Bruno II' })
      .expect(409);
    expect(res.body.error.details[0].field).toBe('microchipId');
  });
});

describe('privacy and access control', () => {
  it('never shows or changes another owner’s pet', async () => {
    const { agent: nimali } = await ownerWithAgent();
    const { agent: kasun } = await ownerWithAgent();
    const { body } = await nimali.post('/api/pets').send(bruno).expect(201);
    const id = body.pet.id;

    expect((await kasun.get('/api/pets')).body.pets).toHaveLength(0);
    await kasun.get(`/api/pets/${id}`).expect(404);
    await kasun
      .put(`/api/pets/${id}`)
      .send({ ...bruno, name: 'Stolen' })
      .expect(404);
    await kasun.delete(`/api/pets/${id}`).expect(404);

    const still = await nimali.get(`/api/pets/${id}`).expect(200);
    expect(still.body.pet.name).toBe('Bruno');
  });

  it('is limited to pet owners', async () => {
    await request(testApp()).get('/api/pets').expect(401);
    const vet = await createUser('VET', { verifiedVet: true });
    const vetAgent = await signedInAgent(vet.email);
    await vetAgent.get('/api/pets').expect(403);
  });
});

describe('pet photos', () => {
  it('resizes the image, converts it to WebP and strips metadata', async () => {
    const { agent } = await ownerWithAgent();
    const { body } = await agent.post('/api/pets').send(bruno).expect(201);

    const res = await agent
      .put(`/api/pets/${body.pet.id}/photo`)
      .attach('photo', await sampleJpeg(), { filename: 'bruno.jpg', contentType: 'image/jpeg' })
      .expect(200);

    const url: string = res.body.pet.photoUrl;
    expect(url).toMatch(/^\/uploads\/pets\/[a-f0-9]{32}\.webp$/);
    const meta = await sharp(uploadPath(url)).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 800, height: 800 });
    expect(meta.exif).toBeUndefined();

    // The stored file is served back to the browser.
    const served = await agent.get(url).expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('replaces the old photo file when a new one is uploaded', async () => {
    const { agent } = await ownerWithAgent();
    const { body } = await agent.post('/api/pets').send(bruno).expect(201);
    const upload = async () =>
      (
        await agent
          .put(`/api/pets/${body.pet.id}/photo`)
          .attach('photo', await sampleJpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' })
      ).body.pet.photoUrl as string;

    const first = await upload();
    const second = await upload();

    expect(second).not.toBe(first);
    expect(existsSync(uploadPath(first))).toBe(false);
    expect(existsSync(uploadPath(second))).toBe(true);
  });

  it('rejects files that are not images, even when renamed', async () => {
    const { agent } = await ownerWithAgent();
    const { body } = await agent.post('/api/pets').send(bruno).expect(201);

    const disguised = await agent
      .put(`/api/pets/${body.pet.id}/photo`)
      .attach('photo', Buffer.from('<script>alert(1)</script>'), {
        filename: 'cute.jpg',
        contentType: 'image/jpeg',
      })
      .expect(422);
    expect(disguised.body.error.details[0]).toEqual({
      field: 'photo',
      message: 'This file is not a valid image',
    });

    const pdf = await agent
      .put(`/api/pets/${body.pet.id}/photo`)
      .attach('photo', Buffer.from('%PDF-1.4'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);
    expect(pdf.body.error.details[0].message).toBe('Please upload a JPG, PNG or WebP image');
  });

  it('rejects photos larger than 5 MB', async () => {
    const { agent } = await ownerWithAgent();
    const { body } = await agent.post('/api/pets').send(bruno).expect(201);

    const res = await agent
      .put(`/api/pets/${body.pet.id}/photo`)
      .attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      })
      .expect(422);
    expect(res.body.error.details[0].message).toBe('Photos must be 5 MB or smaller');
  });

  it('returns 404 for a missing upload instead of a server error', async () => {
    await request(testApp()).get('/uploads/pets/does-not-exist.webp').expect(404);
  });
});
