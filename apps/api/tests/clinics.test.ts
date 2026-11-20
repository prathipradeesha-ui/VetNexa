import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const allDay = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, '00:00-23:59']),
);
const neverOpen = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, 'Closed']),
);

function createClinic(overrides: Record<string, unknown> = {}) {
  const name = (overrides['name'] as string) ?? 'Green Paws Veterinary Clinic';
  return testPrisma.clinic.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      addressLine: '38 Stanley Thilakaratne Mawatha',
      city: 'Colombo',
      district: 'Colombo',
      phone: '0112812236',
      services: ['Vaccination', 'Grooming'],
      openingHours: allDay,
      ...overrides,
    },
  });
}

describe('clinic directory', () => {
  it('lists active clinics best-rated first, with filter options', async () => {
    await createClinic({ name: 'Lagoon Side Animal Clinic', city: 'Negombo', averageRating: 3 });
    await createClinic({
      name: 'Harbourview Animal Hospital',
      averageRating: 4.5,
      services: ['Surgery'],
    });
    await createClinic({ name: 'Closed Down Clinic', isActive: false });

    const res = await request(testApp()).get('/api/clinics').expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.clinics.map((c: { name: string }) => c.name)).toEqual([
      'Harbourview Animal Hospital',
      'Lagoon Side Animal Clinic',
    ]);
    expect(res.body.facets.cities).toEqual(['Colombo', 'Negombo']);
    expect(res.body.facets.services).toEqual(['Grooming', 'Surgery', 'Vaccination']);
  });

  it('filters by text, city, service, emergency care and opening hours', async () => {
    await createClinic({ name: 'Hillside Pet Care Centre', city: 'Kandy', hasEmergency: true });
    await createClinic({
      name: 'Kelani Cat and Dog Clinic',
      services: ['Feline medicine'],
      openingHours: neverOpen,
    });
    await createClinic({
      name: 'Harbourview Animal Hospital',
      isOpen24Hours: true,
      openingHours: neverOpen,
    });
    const names = async (query: string) =>
      (await request(testApp()).get(`/api/clinics?${query}`).expect(200)).body.clinics
        .map((c: { name: string }) => c.name)
        .sort();

    expect(await names('q=hill')).toEqual(['Hillside Pet Care Centre']);
    expect(await names('city=Kandy')).toEqual(['Hillside Pet Care Centre']);
    expect(await names('service=feline%20medicine')).toEqual(['Kelani Cat and Dog Clinic']);
    // Emergency includes clinics open 24 hours.
    expect(await names('emergency=true')).toEqual([
      'Harbourview Animal Hospital',
      'Hillside Pet Care Centre',
    ]);
    expect(await names('openNow=true')).toEqual([
      'Harbourview Animal Hospital',
      'Hillside Pet Care Centre',
    ]);
  });

  it('rejects invalid search parameters', async () => {
    await request(testApp()).get('/api/clinics?sort=price').expect(422);
  });
});

describe('clinic detail', () => {
  it('shows details, verified vets only, rating breakdown and reviews with short names', async () => {
    const clinic = await createClinic();
    const verified = await createUser('VET', { verifiedVet: true });
    const pending = await createUser('VET');
    await testPrisma.vetProfile.updateMany({
      where: { userId: { in: [verified.id, pending.id] } },
      data: { clinicId: clinic.id, specialization: 'Preventive care' },
    });
    const owner = await createUser('OWNER');
    await testPrisma.user.update({
      where: { id: owner.id },
      data: { firstName: 'Nimali', lastName: 'Perera' },
    });
    await testPrisma.review.create({
      data: {
        clinicId: clinic.id,
        authorId: owner.id,
        rating: 5,
        comment: 'Wonderful care for Bruno.',
      },
    });

    const res = await request(testApp()).get(`/api/clinics/${clinic.slug}`).expect(200);
    const detail = res.body.clinic;

    expect(detail.vets).toHaveLength(1);
    expect(detail.vets[0]).toMatchObject({ id: verified.id, specialization: 'Preventive care' });
    expect(detail.reviews[0]).toMatchObject({ rating: 5, author: 'Nimali P.', isMine: false });
    expect(detail.ratingDistribution[0]).toEqual({ stars: 5, count: 1 });
    expect(detail.myReview).toBeNull();
    expect(JSON.stringify(detail)).not.toContain('Perera');
  });

  it('returns 404 for unknown or inactive clinics', async () => {
    await createClinic({ name: 'Old Clinic', isActive: false });
    await request(testApp()).get('/api/clinics/old-clinic').expect(404);
    await request(testApp()).get('/api/clinics/missing').expect(404);
  });
});

describe('reviews', () => {
  it('lets an owner post, update and delete one review, keeping the average correct', async () => {
    const clinic = await createClinic();
    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email);
    const other = await createUser('RESCUER');
    await testPrisma.review.create({
      data: { clinicId: clinic.id, authorId: other.id, rating: 2, comment: 'Long waiting time.' },
    });
    const url = `/api/clinics/${clinic.slug}/reviews/mine`;
    const rating = async () =>
      (await testPrisma.clinic.findUniqueOrThrow({ where: { id: clinic.id } })).averageRating;

    await agent.put(url).send({ rating: 5, comment: 'Excellent and kind staff.' }).expect(200);
    expect(Number(await rating())).toBe(3.5);

    // Posting again replaces the earlier review rather than adding a second one.
    await agent.put(url).send({ rating: 4, comment: 'Still very good, a bit busy.' }).expect(200);
    expect(await testPrisma.review.count({ where: { clinicId: clinic.id } })).toBe(2);
    expect(Number(await rating())).toBe(3);

    const detail = await agent.get(`/api/clinics/${clinic.slug}`).expect(200);
    expect(detail.body.clinic.myReview).toMatchObject({ rating: 4 });
    expect(detail.body.clinic.reviews.find((r: { isMine: boolean }) => r.isMine)).toBeDefined();

    await agent.delete(url).expect(204);
    expect(Number(await rating())).toBe(2);
    expect(
      (await testPrisma.clinic.findUniqueOrThrow({ where: { id: clinic.id } })).reviewCount,
    ).toBe(1);
  });

  it('does not let veterinarians or administrators review clinics', async () => {
    const clinic = await createClinic();
    for (const role of ['VET', 'ADMIN'] as const) {
      const user = await createUser(role, { verifiedVet: true });
      const agent = await signedInAgent(user.email);
      const res = await agent
        .put(`/api/clinics/${clinic.slug}/reviews/mine`)
        .send({ rating: 5, comment: 'Best clinic in town!' })
        .expect(403);
      expect(res.body.error.message).toMatch(/pet owners and rescuers/);
    }
  });

  it('requires sign-in and valid content', async () => {
    const clinic = await createClinic();
    const url = `/api/clinics/${clinic.slug}/reviews/mine`;
    await request(testApp())
      .put(url)
      .send({ rating: 5, comment: 'Great visit overall.' })
      .expect(401);

    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email);
    const res = await agent.put(url).send({ rating: 9, comment: 'Ok' }).expect(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
      'rating',
      'comment',
    ]);
  });
});
