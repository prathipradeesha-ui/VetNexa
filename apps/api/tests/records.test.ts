import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

/** "YYYY-MM-DD" for today plus the given number of days. */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const rabies = {
  type: 'VACCINATION',
  title: 'Anti-rabies vaccine',
  recordDate: day(-10),
  nextDueDate: day(355),
  vetName: 'Dr. Ruwan Senanayake',
  clinicName: 'Green Paws Veterinary Clinic',
};

async function ownerWithPet(name = 'Bruno') {
  const owner = await createUser('OWNER');
  const pet = await testPrisma.pet.create({ data: { ownerId: owner.id, name, species: 'DOG' } });
  return { owner, pet, agent: await signedInAgent(owner.email) };
}

describe('health records', () => {
  it('adds, lists (newest first), updates and deletes records', async () => {
    const { pet, agent } = await ownerWithPet();
    const base = `/api/pets/${pet.id}/records`;

    const created = await agent.post(base).send(rabies).expect(201);
    expect(created.body.record).toMatchObject({
      title: 'Anti-rabies vaccine',
      recordDate: rabies.recordDate,
      nextDueDate: rabies.nextDueDate,
      canEdit: true,
      createdBy: { role: 'OWNER' },
    });
    await agent
      .post(base)
      .send({ type: 'CHECKUP', title: 'Annual check-up', recordDate: day(-1) })
      .expect(201);

    const list = await agent.get(base).expect(200);
    expect(list.body.records.map((r: { title: string }) => r.title)).toEqual([
      'Annual check-up',
      'Anti-rabies vaccine',
    ]);

    const id = created.body.record.id;
    const updated = await agent
      .put(`${base}/${id}`)
      .send({ ...rabies, description: 'Left shoulder, no reaction' })
      .expect(200);
    expect(updated.body.record.description).toBe('Left shoulder, no reaction');

    await agent.delete(`${base}/${id}`).expect(204);
    expect((await agent.get(base)).body.records).toHaveLength(1);
  });

  it('returns field errors for impossible dates', async () => {
    const { pet, agent } = await ownerWithPet();

    const res = await agent
      .post(`/api/pets/${pet.id}/records`)
      .send({ ...rabies, recordDate: day(5), nextDueDate: day(1) })
      .expect(422);

    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('recordDate');
  });

  it('protects records written by a veterinarian from being changed by the owner', async () => {
    const { pet, agent } = await ownerWithPet();
    const vet = await createUser('VET', { verifiedVet: true });
    const vetRecord = await testPrisma.healthRecord.create({
      data: {
        petId: pet.id,
        type: 'TREATMENT',
        title: 'Wound cleaned and dressed',
        recordDate: new Date(day(-3)),
        createdById: vet.id,
      },
    });

    const list = await agent.get(`/api/pets/${pet.id}/records`).expect(200);
    expect(list.body.records[0]).toMatchObject({
      canEdit: false,
      createdBy: { role: 'VET', name: expect.stringMatching(/^Dr\. /) },
    });

    const edit = await agent
      .put(`/api/pets/${pet.id}/records/${vetRecord.id}`)
      .send({ type: 'TREATMENT', title: 'Changed', recordDate: day(-3) })
      .expect(403);
    expect(edit.body.error.message).toMatch(/added by a veterinarian/);
    await agent.delete(`/api/pets/${pet.id}/records/${vetRecord.id}`).expect(403);
  });

  it('keeps each owner’s records private', async () => {
    const { pet } = await ownerWithPet();
    const { agent: stranger } = await ownerWithPet('Other');

    await stranger.get(`/api/pets/${pet.id}/records`).expect(404);
    await stranger.post(`/api/pets/${pet.id}/records`).send(rabies).expect(404);
    await request(testApp()).get(`/api/pets/${pet.id}/records`).expect(401);
  });

  it('does not allow a record to be moved to another pet through the URL', async () => {
    const { owner, pet, agent } = await ownerWithPet();
    const luna = await testPrisma.pet.create({
      data: { ownerId: owner.id, name: 'Luna', species: 'CAT' },
    });
    const { body } = await agent.post(`/api/pets/${pet.id}/records`).send(rabies).expect(201);

    // Record belongs to Bruno, so it is not found under Luna.
    await agent.put(`/api/pets/${luna.id}/records/${body.record.id}`).send(rabies).expect(404);
  });
});

describe('care reminders', () => {
  it('lists overdue and upcoming items across pets, soonest first', async () => {
    const { owner, pet: bruno, agent } = await ownerWithPet();
    const luna = await testPrisma.pet.create({
      data: { ownerId: owner.id, name: 'Luna', species: 'CAT' },
    });
    const add = (petId: string, title: string, recordOffset: number, dueOffset: number | null) =>
      testPrisma.healthRecord.create({
        data: {
          petId,
          type: 'VACCINATION',
          title,
          recordDate: new Date(day(recordOffset)),
          nextDueDate: dueOffset === null ? null : new Date(day(dueOffset)),
        },
      });

    await add(bruno.id, 'Anti-rabies vaccine', -390, -25); // overdue
    await add(luna.id, 'FVRCP booster', -355, 10); // due soon
    await add(bruno.id, 'DHPPi booster', -100, 265); // too far away
    await add(luna.id, 'Spay surgery', -600, null); // no due date

    const res = await agent.get('/api/reminders').expect(200);

    expect(res.body.reminders).toHaveLength(2);
    expect(res.body.reminders[0]).toMatchObject({
      title: 'Anti-rabies vaccine',
      status: 'OVERDUE',
      daysUntilDue: -25,
      pet: { name: 'Bruno' },
    });
    expect(res.body.reminders[1]).toMatchObject({
      title: 'FVRCP booster',
      status: 'UPCOMING',
      daysUntilDue: 10,
      pet: { name: 'Luna' },
    });
  });

  it('stops reminding once a newer entry of the same item is recorded', async () => {
    const { pet, agent } = await ownerWithPet();
    await testPrisma.healthRecord.create({
      data: {
        petId: pet.id,
        type: 'VACCINATION',
        title: 'Anti-rabies vaccine',
        recordDate: new Date(day(-390)),
        nextDueDate: new Date(day(-25)),
      },
    });
    expect((await agent.get('/api/reminders')).body.reminders).toHaveLength(1);

    // The owner records this year's vaccine (title typed slightly differently).
    await agent
      .post(`/api/pets/${pet.id}/records`)
      .send({ ...rabies, title: 'anti-rabies vaccine ', recordDate: day(0), nextDueDate: day(365) })
      .expect(201);

    expect((await agent.get('/api/reminders')).body.reminders).toHaveLength(0);
  });

  it('only includes the signed-in owner’s pets', async () => {
    const { pet } = await ownerWithPet();
    await testPrisma.healthRecord.create({
      data: {
        petId: pet.id,
        type: 'MEDICATION',
        title: 'Deworming',
        recordDate: new Date(day(-80)),
        nextDueDate: new Date(day(5)),
      },
    });
    const { agent: other } = await ownerWithPet('Max');

    expect((await other.get('/api/reminders')).body.reminders).toHaveLength(0);
  });
});
