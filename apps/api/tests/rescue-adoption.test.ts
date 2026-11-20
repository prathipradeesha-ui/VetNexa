import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const report = {
  species: 'DOG',
  title: 'Injured puppy near bus stand',
  description: 'Small brown puppy limping, with a wound on the back leg.',
  locationText: 'Negombo main bus stand, near the fruit stalls',
  city: 'Negombo',
  urgency: 'HIGH',
  contactPhone: '0769876543',
};

async function people() {
  const reporter = await createUser('OWNER');
  const rescuer = await createUser('RESCUER');
  const otherRescuer = await createUser('RESCUER');
  return {
    reporter: await signedInAgent(reporter.email),
    rescuer: await signedInAgent(rescuer.email),
    otherRescuer: await signedInAgent(otherRescuer.email),
  };
}

describe('rescue reports', () => {
  it('runs from report to rescue, with the reporter’s phone shown only to rescuers', async () => {
    const { reporter, rescuer } = await people();

    const created = await reporter.post('/api/rescue').send(report).expect(201);
    const id = created.body.report.id;
    expect(created.body.report).toMatchObject({
      status: 'OPEN',
      reporter: { isMe: true, phone: null },
      actions: { canTakeOn: false, canClose: true },
    });

    const board = await rescuer.get('/api/rescue').expect(200);
    expect(board.body.reports[0]).toMatchObject({
      id,
      reporter: { phone: '0769876543' },
      actions: { canTakeOn: true },
    });

    const taken = await rescuer.post(`/api/rescue/${id}/take-on`).expect(200);
    expect(taken.body.report).toMatchObject({
      status: 'IN_PROGRESS',
      assignedTo: { isMe: true },
      actions: { canResolve: true },
    });

    // The reporter can see who is helping and how to reach them.
    const seen = await reporter.get(`/api/rescue/${id}`).expect(200);
    expect(seen.body.report.assignedTo.name).toBeTruthy();

    await rescuer.patch(`/api/rescue/${id}/status`).send({ status: 'RESCUED' }).expect(200);
    const resolved = await rescuer.get('/api/rescue?view=resolved').expect(200);
    expect(resolved.body.reports.map((r: { id: string }) => r.id)).toContain(id);
  });

  it('lets only one rescuer take on a report, and only they can resolve it', async () => {
    const { reporter, rescuer, otherRescuer } = await people();
    const { body } = await reporter.post('/api/rescue').send(report).expect(201);
    const id = body.report.id;

    await rescuer.post(`/api/rescue/${id}/take-on`).expect(200);
    const second = await otherRescuer.post(`/api/rescue/${id}/take-on`).expect(409);
    expect(second.body.error.message).toMatch(/already taken on/);
    await otherRescuer.patch(`/api/rescue/${id}/status`).send({ status: 'RESCUED' }).expect(403);
    await reporter.post(`/api/rescue/${id}/take-on`).expect(403); // owners cannot take on rescues
  });

  it('lists the most urgent waiting reports first', async () => {
    const { reporter, rescuer } = await people();
    for (const urgency of ['LOW', 'CRITICAL', 'MEDIUM']) {
      await reporter
        .post('/api/rescue')
        .send({ ...report, urgency, title: `${urgency} case report` })
        .expect(201);
    }
    const res = await rescuer.get('/api/rescue').expect(200);
    expect(res.body.reports.map((r: { urgency: string }) => r.urgency)).toEqual([
      'CRITICAL',
      'MEDIUM',
      'LOW',
    ]);
  });

  it('shows other users only their own reports', async () => {
    const { reporter } = await people();
    await reporter.post('/api/rescue').send(report).expect(201);
    const stranger = await createUser('OWNER');
    const strangerAgent = await signedInAgent(stranger.email);

    expect((await strangerAgent.get('/api/rescue')).body.reports).toHaveLength(0);
    await request(testApp()).get('/api/rescue').expect(401);
  });
});

const listing = {
  name: 'Coco',
  species: 'DOG',
  breed: 'Mixed breed',
  sex: 'FEMALE',
  ageGroup: 'YOUNG',
  size: 'Medium',
  city: 'Colombo',
  description: 'A playful, affectionate young dog who loves car rides and belly rubs.',
  isVaccinated: true,
  isNeutered: true,
  goodWithChildren: 'yes',
  goodWithPets: '',
};

const application = {
  homeType: 'House with garden',
  hasOtherPets: true,
  hasChildren: false,
  contactPhone: '0771234567',
  message: 'We have a large garden and work from home three days a week. Max would love a friend.',
};

async function listingWithApplicants(count: number) {
  const rescuerUser = await createUser('RESCUER');
  const rescuer = await signedInAgent(rescuerUser.email);
  const { body } = await rescuer.post('/api/adoption/listings').send(listing).expect(201);
  const applicants = [];
  for (let i = 0; i < count; i += 1) {
    const owner = await createUser('OWNER');
    const agent = await signedInAgent(owner.email);
    const res = await agent
      .post(`/api/adoption/listings/${body.listing.id}/applications`)
      .send(application)
      .expect(201);
    applicants.push({ agent, applicationId: res.body.application.id as string });
  }
  return { rescuer, listingId: body.listing.id as string, applicants };
}

describe('adoption listings', () => {
  it('publishes listings and filters them for visitors', async () => {
    const { listingId } = await listingWithApplicants(0);
    const visitor = request(testApp());

    const all = await visitor.get('/api/adoption/listings').expect(200);
    expect(all.body.listings[0]).toMatchObject({
      id: listingId,
      goodWithChildren: true,
      goodWithPets: null,
    });
    expect(all.body.cities).toEqual(['Colombo']);
    expect((await visitor.get('/api/adoption/listings?species=CAT')).body.listings).toHaveLength(0);
    expect(
      (await visitor.get('/api/adoption/listings?goodWithChildren=true')).body.listings,
    ).toHaveLength(1);

    const detail = await visitor.get(`/api/adoption/listings/${listingId}`).expect(200);
    expect(detail.body.listing).toMatchObject({
      name: 'Coco',
      canApply: false,
      myApplication: null,
    });
  });

  it('only lets rescuers create listings, and only the owner rescuer edit them', async () => {
    const { listingId } = await listingWithApplicants(0);
    const owner = await createUser('OWNER');
    const ownerAgent = await signedInAgent(owner.email);
    const otherRescuer = await createUser('RESCUER');
    const otherAgent = await signedInAgent(otherRescuer.email);

    await ownerAgent.post('/api/adoption/listings').send(listing).expect(403);
    await otherAgent.put(`/api/adoption/listings/${listingId}`).send(listing).expect(404);
    await otherAgent.get(`/api/adoption/listings/${listingId}/applications`).expect(404);
  });

  it('hides withdrawn animals from the public but not from their rescuer', async () => {
    const { rescuer, listingId } = await listingWithApplicants(0);
    await rescuer
      .patch(`/api/adoption/listings/${listingId}/status`)
      .send({ status: 'WITHDRAWN' })
      .expect(200);

    await request(testApp()).get(`/api/adoption/listings/${listingId}`).expect(404);
    await rescuer.get(`/api/adoption/listings/${listingId}`).expect(200);
  });
});

describe('adoption applications', () => {
  it('accepts one application per owner and lets them withdraw and re-apply', async () => {
    const { listingId, applicants } = await listingWithApplicants(1);
    const { agent, applicationId } = applicants[0]!;

    await agent
      .post(`/api/adoption/listings/${listingId}/applications`)
      .send(application)
      .expect(409);
    await agent.post(`/api/adoption/applications/${applicationId}/withdraw`).expect(204);
    await agent
      .post(`/api/adoption/listings/${listingId}/applications`)
      .send(application)
      .expect(201);

    const mine = await agent.get('/api/adoption/applications/mine').expect(200);
    expect(mine.body.applications[0]).toMatchObject({
      status: 'SUBMITTED',
      listing: { name: 'Coco' },
    });
  });

  it('approving one application adopts the animal and closes the others kindly', async () => {
    const { rescuer, applicants } = await listingWithApplicants(3);
    const [chosen, second, third] = applicants;

    const review = await rescuer
      .patch(`/api/adoption/applications/${chosen!.applicationId}/decision`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    expect(review.body.listing.status).toBe('PENDING');
    expect(review.body.applications[0].contactPhone).toBe('0771234567');

    const approved = await rescuer
      .patch(`/api/adoption/applications/${chosen!.applicationId}/decision`)
      .send({ status: 'APPROVED', rescuerNotes: 'Home visit went well.' })
      .expect(200);
    expect(approved.body.listing.status).toBe('ADOPTED');

    for (const other of [second!, third!]) {
      const mine = await other.agent.get('/api/adoption/applications/mine').expect(200);
      expect(mine.body.applications[0]).toMatchObject({
        status: 'REJECTED',
        rescuerNotes: expect.stringMatching(/found a home/),
      });
    }

    // Adopted animals leave the public list and accept no further decisions.
    expect((await request(testApp()).get('/api/adoption/listings')).body.listings).toHaveLength(0);
    await rescuer
      .patch(`/api/adoption/applications/${second!.applicationId}/decision`)
      .send({ status: 'APPROVED' })
      .expect(409);
  });

  it('makes the animal available again when the only application under review is rejected', async () => {
    const { rescuer, listingId, applicants } = await listingWithApplicants(1);
    const id = applicants[0]!.applicationId;
    await rescuer
      .patch(`/api/adoption/applications/${id}/decision`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    const res = await rescuer
      .patch(`/api/adoption/applications/${id}/decision`)
      .send({ status: 'REJECTED' })
      .expect(200);
    expect(res.body.listing.status).toBe('AVAILABLE');
    expect(
      (await request(testApp()).get(`/api/adoption/listings/${listingId}`)).body.listing.status,
    ).toBe('AVAILABLE');
  });

  it('only lets pet owners apply', async () => {
    const { listingId } = await listingWithApplicants(0);
    const vet = await createUser('VET', { verifiedVet: true });
    const vetAgent = await signedInAgent(vet.email);
    await vetAgent
      .post(`/api/adoption/listings/${listingId}/applications`)
      .send(application)
      .expect(403);
    await request(testApp())
      .post(`/api/adoption/listings/${listingId}/applications`)
      .send(application)
      .expect(401);
  });
});
