import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { weekStart } from '../src/modules/admin/admin.stats';
import { slugify } from '../src/modules/admin/admin.service';
import { createUser, resetDatabase, signedInAgent, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const hours = {
  mon: '08:00-20:00',
  tue: '08:00-20:00',
  wed: '08:00-20:00',
  thu: '08:00-20:00',
  fri: '08:00-20:00',
  sat: '09:00-13:00',
  sun: 'Closed',
};

const clinicForm = {
  name: 'Kandy Lake Pet Clinic',
  description: 'Small-animal clinic near the lake.',
  addressLine: '12 Dalada Veediya',
  city: 'Kandy',
  district: 'Kandy',
  latitude: '7.2936',
  longitude: 80.6413,
  phone: '0812234567',
  email: '',
  website: 'https://example.lk',
  services: ['Vaccination', 'Surgery', 'Vaccination'],
  openingHours: hours,
  hasEmergency: false,
  isOpen24Hours: false,
};

async function adminAgent() {
  const admin = await createUser('ADMIN');
  return { admin, agent: await signedInAgent(admin.email) };
}

describe('admin statistics', () => {
  it('counts users, pets, clinics, assistant emergencies and moderation work', async () => {
    const { agent } = await adminAgent();
    const owner = await createUser('OWNER');
    await createUser('VET', { verifiedVet: false });
    await createUser('RESCUER', { suspended: true });
    await testPrisma.pet.createMany({
      data: [
        { ownerId: owner.id, name: 'Bruno', species: 'DOG' },
        { ownerId: owner.id, name: 'Luna', species: 'CAT' },
      ],
    });
    await testPrisma.chatMessage.createMany({
      data: [
        { userId: owner.id, sender: 'USER', content: 'my dog ate chocolate' },
        {
          userId: owner.id,
          sender: 'ASSISTANT',
          content: 'Emergency',
          payload: { kind: 'emergency' },
        },
      ],
    });
    await testPrisma.contactMessage.create({
      data: { name: 'A', email: 'a@example.com', topic: 'GENERAL', message: 'Hello there team' },
    });

    const { stats } = (await agent.get('/api/admin/stats').expect(200)).body;
    expect(stats.users).toMatchObject({
      total: 4,
      suspended: 1,
      byRole: { OWNER: 1, VET: 1, RESCUER: 1, ADMIN: 1 },
      newLast30Days: 4,
    });
    expect(stats.users.signupsByWeek).toHaveLength(8);
    expect(stats.users.signupsByWeek.at(-1).count).toBe(4);
    expect(stats.vets).toEqual({ verified: 0, pending: 1 });
    expect(stats.pets).toEqual({
      total: 2,
      bySpecies: { DOG: 1, CAT: 1, RABBIT: 0, BIRD: 0, OTHER: 0 },
    });
    expect(stats.assistant).toEqual({ questions: 1, emergencies: 1 });
    expect(stats.moderation.newMessages).toBe(1);
  });

  it('starts weeks on Monday', () => {
    // Sunday 22 November 2026 belongs to the week starting Monday 16 November.
    expect(weekStart(new Date('2026-11-22T10:00:00Z')).toISOString()).toBe(
      '2026-11-16T00:00:00.000Z',
    );
  });
});

describe('user management', () => {
  it('searches, filters and paginates users', async () => {
    const { agent } = await adminAgent();
    await createUser('OWNER');
    await createUser('VET');

    const all = (await agent.get('/api/admin/users').expect(200)).body;
    expect(all).toMatchObject({ total: 3, page: 1, pages: 1 });
    expect(all.users[0]).not.toHaveProperty('passwordHash');

    const vets = (await agent.get('/api/admin/users?role=VET').expect(200)).body;
    expect(vets.users).toHaveLength(1);
    expect(vets.users[0].vetProfile).toMatchObject({ isVerified: false });

    const search = (await agent.get('/api/admin/users?q=owner').expect(200)).body;
    expect(search.users.map((u: { role: string }) => u.role)).toEqual(['OWNER']);
  });

  it('suspends a user, which blocks them at once, and reactivates them', async () => {
    const { agent } = await adminAgent();
    const owner = await createUser('OWNER');
    const ownerAgent = await signedInAgent(owner.email);

    await agent
      .patch(`/api/admin/users/${owner.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await ownerAgent.get('/api/pets').expect(403);

    await agent.patch(`/api/admin/users/${owner.id}/status`).send({ status: 'ACTIVE' }).expect(200);
    expect((await testPrisma.user.findUnique({ where: { id: owner.id } }))?.status).toBe('ACTIVE');
  });

  it('never suspends the admin themself or another administrator', async () => {
    const { admin, agent } = await adminAgent();
    const other = await createUser('ADMIN');
    await agent
      .patch(`/api/admin/users/${admin.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(403);
    await agent
      .patch(`/api/admin/users/${other.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(403);
    await agent.patch('/api/admin/users/nope/status').send({ status: 'SUSPENDED' }).expect(404);
  });
});

describe('clinic management', () => {
  it('adds a clinic with a unique public slug and cleaned-up fields', async () => {
    const { agent } = await adminAgent();
    const first = (await agent.post('/api/admin/clinics').send(clinicForm).expect(201)).body.clinic;
    expect(first).toMatchObject({
      slug: 'kandy-lake-pet-clinic-kandy',
      latitude: 7.2936,
      email: null,
      services: ['Vaccination', 'Surgery'],
      isActive: true,
    });

    const second = (await agent.post('/api/admin/clinics').send(clinicForm).expect(201)).body
      .clinic;
    expect(second.slug).toBe('kandy-lake-pet-clinic-kandy-2');
  });

  it('validates the form, including opening hours and phone number', async () => {
    const { agent } = await adminAgent();
    const res = await agent
      .post('/api/admin/clinics')
      .send({ ...clinicForm, phone: '12345', openingHours: { ...hours, mon: '20:00-08:00' } })
      .expect(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['phone', 'openingHours.mon']));
  });

  it('edits a clinic without changing its URL, and hides it from the directory', async () => {
    const { agent } = await adminAgent();
    const clinic = (await agent.post('/api/admin/clinics').send(clinicForm).expect(201)).body
      .clinic;

    const edited = (
      await agent
        .put(`/api/admin/clinics/${clinic.id}`)
        .send({ ...clinicForm, name: 'Kandy Lakeside Clinic', hasEmergency: true })
        .expect(200)
    ).body.clinic;
    expect(edited).toMatchObject({ name: 'Kandy Lakeside Clinic', slug: clinic.slug });

    await agent.get(`/api/clinics/${clinic.slug}`).expect(200);
    await agent
      .patch(`/api/admin/clinics/${clinic.id}/active`)
      .send({ isActive: false })
      .expect(200);
    await agent.get(`/api/clinics/${clinic.slug}`).expect(404);

    const list = (await agent.get('/api/admin/clinics').expect(200)).body.clinics;
    expect(list).toHaveLength(1);
    expect(list[0].isActive).toBe(false);
  });

  it('makes readable slugs', () => {
    expect(slugify('Pawsome Café & Clinic', 'Galle')).toBe('pawsome-cafe-clinic-galle');
  });
});

describe('content moderation', () => {
  it('hides a review and updates the clinic rating', async () => {
    const { agent } = await adminAgent();
    const clinic = (await agent.post('/api/admin/clinics').send(clinicForm).expect(201)).body
      .clinic;
    const [a, b] = [await createUser('OWNER'), await createUser('OWNER')];
    await signedInAgent(a.email).then((ag) =>
      ag
        .put(`/api/clinics/${clinic.slug}/reviews/mine`)
        .send({ rating: 5, comment: 'Wonderful, caring staff.' }),
    );
    await signedInAgent(b.email).then((ag) =>
      ag
        .put(`/api/clinics/${clinic.slug}/reviews/mine`)
        .send({ rating: 1, comment: 'Spam spam spam spam spam.' }),
    );

    const reviews = (await agent.get('/api/admin/reviews').expect(200)).body.reviews;
    expect(reviews).toHaveLength(2);
    const spam = reviews.find((r: { rating: number }) => r.rating === 1);

    await agent.patch(`/api/admin/reviews/${spam.id}`).send({ status: 'REJECTED' }).expect(200);
    let updated = (await agent.get(`/api/admin/clinics/${clinic.id}`)).body.clinic;
    expect(updated).toMatchObject({ averageRating: 5, reviewCount: 1 });

    const hidden = (await agent.get('/api/admin/reviews?status=REJECTED').expect(200)).body;
    expect(hidden.reviews).toHaveLength(1);

    await agent.patch(`/api/admin/reviews/${spam.id}`).send({ status: 'APPROVED' }).expect(200);
    updated = (await agent.get(`/api/admin/clinics/${clinic.id}`)).body.clinic;
    expect(updated).toMatchObject({ averageRating: 3, reviewCount: 2 });
  });

  it('works through contact messages', async () => {
    const { agent } = await adminAgent();
    const message = await testPrisma.contactMessage.create({
      data: {
        name: 'Kasun',
        email: 'kasun@example.com',
        topic: 'CLINIC_LISTING',
        message: 'Please list our clinic in Kandy.',
      },
    });

    expect((await agent.get('/api/admin/messages?status=NEW').expect(200)).body.total).toBe(1);
    await agent.patch(`/api/admin/messages/${message.id}`).send({ status: 'RESOLVED' }).expect(200);
    expect((await agent.get('/api/admin/messages?status=NEW').expect(200)).body.total).toBe(0);
    await agent.patch(`/api/admin/messages/${message.id}`).send({ status: 'DONE' }).expect(422);
  });

  it('is only available to administrators', async () => {
    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email);
    for (const path of ['/api/admin/stats', '/api/admin/users', '/api/admin/clinics']) {
      await agent.get(path).expect(403);
    }
  });
});
