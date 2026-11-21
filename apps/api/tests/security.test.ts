import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

/*
 * Security review (Stage 25): checks that nobody can reach another person's data by changing
 * an ID in the URL. Other modules have their own tests for this; these cover the remaining
 * routes. Someone else's item is reported as "not found", so its existence is not revealed.
 */

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const smallJpeg = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: '#a0522d' } })
    .jpeg()
    .toBuffer();

async function ownerWithAssessment() {
  const owner = await createUser('OWNER');
  const pet = await testPrisma.pet.create({
    data: { ownerId: owner.id, name: 'Bruno', species: 'DOG' },
  });
  const assessment = await testPrisma.woundAssessment.create({
    data: {
      petId: pet.id,
      userId: owner.id,
      imageUrl: '/uploads/wounds/abc123.webp',
      status: 'ASSESSED',
      predictedClass: 'laceration',
      confidence: 0.8,
      severity: 'MODERATE',
      referToVet: true,
      probabilities: { laceration: 0.8 },
      summary: 'The photo most likely shows a cut.',
      guidance: 'Contact a veterinarian within 24 hours.',
      modelVersion: 'test',
    },
  });
  return { owner, pet, assessment };
}

describe('wound checks', () => {
  it('are hidden from other owners, who cannot open or delete them', async () => {
    const { owner, assessment } = await ownerWithAssessment();
    const stranger = await signedInAgent((await createUser('OWNER')).email);

    await stranger.get(`/api/assessments/${assessment.id}`).expect(404);
    await stranger.delete(`/api/assessments/${assessment.id}`).expect(404);
    const list = await stranger.get('/api/assessments').expect(200);
    expect(JSON.stringify(list.body)).not.toContain(assessment.id);

    expect(await testPrisma.woundAssessment.count()).toBe(1);
    await (await signedInAgent(owner.email)).get(`/api/assessments/${assessment.id}`).expect(200);
  });

  it('cannot be opened by vets or administrators through the owner URL', async () => {
    const { assessment } = await ownerWithAssessment();
    for (const role of ['VET', 'ADMIN', 'RESCUER'] as const) {
      const agent = await signedInAgent((await createUser(role, { verifiedVet: true })).email);
      const res = await agent.get(`/api/assessments/${assessment.id}`);
      expect([403, 404]).toContain(res.status);
    }
  });
});

describe('pet photos', () => {
  it('cannot be changed or removed by another owner', async () => {
    const { pet } = await ownerWithAssessment();
    const stranger = await signedInAgent((await createUser('OWNER')).email);

    await stranger
      .put(`/api/pets/${pet.id}/photo`)
      .attach('photo', await smallJpeg(), { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(404);
    await stranger.delete(`/api/pets/${pet.id}/photo`).expect(404);
  });
});

describe('rescue report photos', () => {
  it('can only be added by the person who reported the animal', async () => {
    const reporter = await signedInAgent((await createUser('OWNER')).email);
    const rescuer = await signedInAgent((await createUser('RESCUER')).email);
    const created = await reporter
      .post('/api/rescue')
      .send({
        species: 'DOG',
        title: 'Injured puppy near bus stand',
        description: 'Small brown puppy limping, with a wound on the back leg.',
        locationText: 'Negombo main bus stand',
        city: 'Negombo',
        urgency: 'HIGH',
        contactPhone: '0769876543',
      })
      .expect(201);

    const res = await rescuer
      .put(`/api/rescue/${created.body.report.id}/photo`)
      .attach('photo', await smallJpeg(), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });
});

describe('adoption applications', () => {
  async function listingWithApplication() {
    const rescuer = await signedInAgent((await createUser('RESCUER')).email);
    const { body } = await rescuer
      .post('/api/adoption/listings')
      .send({
        name: 'Coco',
        species: 'DOG',
        sex: 'FEMALE',
        ageGroup: 'YOUNG',
        city: 'Colombo',
        description: 'A playful, affectionate young dog who loves car rides and belly rubs.',
        isVaccinated: true,
        isNeutered: true,
      })
      .expect(201);
    const applicant = await signedInAgent((await createUser('OWNER')).email);
    const applied = await applicant
      .post(`/api/adoption/listings/${body.listing.id}/applications`)
      .send({
        homeType: 'House with garden',
        hasOtherPets: false,
        hasChildren: false,
        contactPhone: '0771234567',
        message: 'We have a large garden and work from home three days a week.',
      })
      .expect(201);
    return {
      listingId: body.listing.id as string,
      applicationId: applied.body.application.id as string,
    };
  }

  it('are only shown to and decided by the rescuer who listed the animal', async () => {
    const { listingId, applicationId } = await listingWithApplication();
    const otherRescuer = await signedInAgent((await createUser('RESCUER')).email);

    await otherRescuer.get(`/api/adoption/listings/${listingId}/applications`).expect(404);
    await otherRescuer
      .patch(`/api/adoption/applications/${applicationId}/decision`)
      .send({ status: 'APPROVED' })
      .expect(404);
    const application = await testPrisma.adoptionApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(application.status).not.toBe('APPROVED');
  });

  it('cannot be withdrawn by anyone except the applicant', async () => {
    const { applicationId } = await listingWithApplication();
    const otherOwner = await signedInAgent((await createUser('OWNER')).email);

    await otherOwner.post(`/api/adoption/applications/${applicationId}/withdraw`).expect(404);
    const application = await testPrisma.adoptionApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(application.status).not.toBe('WITHDRAWN');
  });
});

describe('error responses', () => {
  it('never include stack traces or internal details', async () => {
    const res = await request(testApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|stack/i);
  });
});
