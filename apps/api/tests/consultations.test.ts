import { isoToColombo } from '@vetnexa/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

/** Sri Lanka date N days from now. */
const colomboDay = (offset: number) =>
  isoToColombo(new Date(Date.now() + offset * 86_400_000).toISOString()).date;

async function setup() {
  const clinic = await testPrisma.clinic.create({
    data: {
      name: 'Green Paws Veterinary Clinic',
      slug: 'green-paws',
      addressLine: '38 Stanley Thilakaratne Mawatha',
      city: 'Nugegoda',
      district: 'Colombo',
      phone: '0112812236',
      services: [],
      openingHours: {},
    },
  });
  const owner = await createUser('OWNER');
  const vet = await createUser('VET', { verifiedVet: true });
  await testPrisma.vetProfile.update({ where: { userId: vet.id }, data: { clinicId: clinic.id } });
  const pet = await testPrisma.pet.create({
    data: { ownerId: owner.id, name: 'Bruno', species: 'DOG' },
  });
  return {
    clinic,
    owner,
    vet,
    pet,
    ownerAgent: await signedInAgent(owner.email),
    vetAgent: await signedInAgent(vet.email),
  };
}

const booking = (petId: string, vetId: string, change: Record<string, unknown> = {}) => ({
  petId,
  vetId,
  type: 'IN_PERSON',
  date: colomboDay(3),
  time: '16:00',
  reason: 'Annual vaccination booster and check-up.',
  ...change,
});

describe('booking a consultation', () => {
  it('lets an owner request a consultation with a verified vet at their clinic', async () => {
    const { ownerAgent, pet, vet, clinic } = await setup();

    const res = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id))
      .expect(201);

    expect(res.body.consultation).toMatchObject({
      status: 'REQUESTED',
      pet: { id: pet.id, name: 'Bruno' },
      clinic: { id: clinic.id },
      owner: null, // owners do not receive their own contact block
      actions: { canCancel: true, canConfirm: false, canComplete: false },
    });
    // 16:00 in Colombo is 10:30 UTC.
    expect(res.body.consultation.scheduledAt).toBe(`${colomboDay(3)}T10:30:00.000Z`);
  });

  it('prevents double-booking the same vet within 30 minutes', async () => {
    const { ownerAgent, pet, vet } = await setup();
    await ownerAgent.post('/api/consultations').send(booking(pet.id, vet.id)).expect(201);

    const clash = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id, { time: '16:00' }))
      .expect(409);
    expect(clash.body.error.details[0].field).toBe('time');

    await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id, { time: '16:30' }))
      .expect(201);
  });

  it('refuses unverified vets and other owners’ pets', async () => {
    const { ownerAgent, pet, vet } = await setup();
    const unverified = await createUser('VET');
    const stranger = await createUser('OWNER');
    const strangerAgent = await signedInAgent(stranger.email);

    const res = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, unverified.id))
      .expect(422);
    expect(res.body.error.details[0].field).toBe('vetId');
    await strangerAgent.post('/api/consultations').send(booking(pet.id, vet.id)).expect(404);
  });

  it('lists only verified vets for booking', async () => {
    const { ownerAgent, vet } = await setup();
    await createUser('VET'); // unverified

    const res = await ownerAgent.get('/api/vets').expect(200);
    expect(res.body.vets.map((v: { id: string }) => v.id)).toEqual([vet.id]);
    expect(res.body.vets[0].clinic.name).toBe('Green Paws Veterinary Clinic');
  });
});

describe('vet workflow', () => {
  it('confirms, completes and adds a locked record to the pet’s history', async () => {
    const { ownerAgent, vetAgent, pet, vet } = await setup();
    const { body } = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id))
      .expect(201);
    const id = body.consultation.id;

    const requests = await vetAgent.get('/api/consultations?view=requests').expect(200);
    expect(requests.body.consultations[0]).toMatchObject({
      id,
      owner: { name: expect.any(String) },
      actions: { canConfirm: true, canViewPatient: true },
    });

    // Completing before confirming is not allowed.
    await vetAgent
      .post(`/api/consultations/${id}/complete`)
      .send({ diagnosis: 'Healthy', treatment: 'Vaccinated' })
      .expect(409);

    await vetAgent
      .patch(`/api/consultations/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    const done = await vetAgent
      .post(`/api/consultations/${id}/complete`)
      .send({
        diagnosis: 'Healthy, mild tartar',
        treatment: 'DHPPi booster given; dental cleaning advised',
        followUpDate: colomboDay(30),
      })
      .expect(200);
    expect(done.body.consultation).toMatchObject({
      status: 'COMPLETED',
      diagnosis: 'Healthy, mild tartar',
    });

    // The owner sees the outcome and a new health record they cannot edit.
    const records = await ownerAgent.get(`/api/pets/${pet.id}/records`).expect(200);
    expect(records.body.records[0]).toMatchObject({
      type: 'TREATMENT',
      title: 'Consultation: Healthy, mild tartar',
      nextDueDate: colomboDay(30),
      canEdit: false,
      createdBy: { role: 'VET' },
    });
  });

  it('only lets each side take the actions allowed to them', async () => {
    const { ownerAgent, vetAgent, pet, vet } = await setup();
    const { body } = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id))
      .expect(201);
    const id = body.consultation.id;

    // Owners cannot confirm, or complete.
    await ownerAgent
      .patch(`/api/consultations/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(409);
    await ownerAgent
      .post(`/api/consultations/${id}/complete`)
      .send({ diagnosis: 'Fine', treatment: 'None' })
      .expect(403);

    // Owner cancels; nothing more can happen afterwards.
    const cancelled = await ownerAgent
      .patch(`/api/consultations/${id}/status`)
      .send({ status: 'CANCELLED', note: 'Bruno is feeling better' })
      .expect(200);
    expect(cancelled.body.consultation.vetNotes).toBe(
      'Cancelled by the owner: Bruno is feeling better',
    );
    await vetAgent
      .patch(`/api/consultations/${id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(409);
  });

  it('hides consultations from anyone not taking part', async () => {
    const { ownerAgent, pet, vet } = await setup();
    const { body } = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id))
      .expect(201);
    const otherVet = await createUser('VET', { verifiedVet: true });
    const otherAgent = await signedInAgent(otherVet.email);

    await otherAgent.get(`/api/consultations/${body.consultation.id}`).expect(404);
    expect((await otherAgent.get('/api/consultations?view=all')).body.consultations).toHaveLength(
      0,
    );
  });

  it('keeps unverified vets out of the portal', async () => {
    const unverified = await createUser('VET');
    const agent = await signedInAgent(unverified.email);

    const res = await agent.get('/api/consultations').expect(403);
    expect(res.body.error.message).toMatch(/still being verified/);
    await agent.get('/api/vet/summary').expect(403);
  });
});

describe('patient access', () => {
  it('opens a patient’s history only while the vet has a non-cancelled consultation', async () => {
    const { ownerAgent, vetAgent, pet, vet } = await setup();
    await testPrisma.healthRecord.create({
      data: {
        petId: pet.id,
        type: 'ALLERGY',
        title: 'Chicken allergy',
        recordDate: new Date('2025-01-01'),
      },
    });

    await vetAgent.get(`/api/vet/patients/${pet.id}`).expect(404); // no consultation yet

    const { body } = await ownerAgent
      .post('/api/consultations')
      .send(booking(pet.id, vet.id))
      .expect(201);
    const patient = await vetAgent.get(`/api/vet/patients/${pet.id}`).expect(200);
    expect(patient.body.patient).toMatchObject({
      name: 'Bruno',
      owner: { name: expect.any(String) },
    });
    expect(patient.body.patient.records[0].title).toBe('Chicken allergy');

    await ownerAgent
      .patch(`/api/consultations/${body.consultation.id}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    await vetAgent.get(`/api/vet/patients/${pet.id}`).expect(404);
  });

  it('is closed to owners and visitors', async () => {
    const { ownerAgent, pet } = await setup();
    await ownerAgent.get(`/api/vet/patients/${pet.id}`).expect(403);
    await request(testApp()).get('/api/vet/summary').expect(401);
  });
});

describe('vet dashboard summary', () => {
  it('counts requests, this week’s appointments and today’s schedule', async () => {
    const { owner, vet, pet, vetAgent } = await setup();
    const now = Date.now();
    const at = (hoursFromNow: number) => new Date(now + hoursFromNow * 3_600_000);
    const make = (
      scheduledAt: Date,
      status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    ) =>
      testPrisma.consultation.create({
        data: {
          petId: pet.id,
          ownerId: owner.id,
          vetId: vet.id,
          scheduledAt,
          status,
          reason: 'Check-up visit',
        },
      });
    await make(at(48), 'REQUESTED');
    await make(at(72), 'CONFIRMED');
    await make(at(24 * 20), 'CONFIRMED'); // beyond this week
    await make(at(-1), 'CANCELLED');

    const res = await vetAgent.get('/api/vet/summary').expect(200);

    expect(res.body).toMatchObject({ pendingRequests: 1, upcomingWeek: 2 });
    expect(Array.isArray(res.body.today)).toBe(true);
  });
});
