import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, resetDatabase, signedInAgent, testApp, testPrisma } from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('role-based access to /api/admin', () => {
  it('returns 401 when not signed in', async () => {
    const res = await request(testApp()).get('/api/admin/vets/pending');
    expect(res.status).toBe(401);
  });

  it.each(['OWNER', 'VET', 'RESCUER'] as const)('returns 403 for the %s role', async (role) => {
    const user = await createUser(role, { verifiedVet: true });
    const agent = await signedInAgent(user.email);

    const res = await agent.get('/api/admin/vets/pending');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('applies a role change on the next request without signing in again', async () => {
    const user = await createUser('ADMIN');
    const agent = await signedInAgent(user.email);
    expect((await agent.get('/api/admin/vets/pending')).status).toBe(200);

    await testPrisma.user.update({ where: { id: user.id }, data: { role: 'OWNER' } });

    expect((await agent.get('/api/admin/vets/pending')).status).toBe(403);
  });
});

describe('vet verification', () => {
  it('lists only unverified vets', async () => {
    const admin = await createUser('ADMIN');
    const pending = await createUser('VET', { verifiedVet: false });
    await createUser('VET', { verifiedVet: true });
    const agent = await signedInAgent(admin.email);

    const res = await agent.get('/api/admin/vets/pending');

    expect(res.status).toBe(200);
    expect(res.body.vets).toHaveLength(1);
    expect(res.body.vets[0].user.id).toBe(pending.id);
  });

  it('lets an admin approve a vet, after which the vet is verified', async () => {
    const admin = await createUser('ADMIN');
    const vet = await createUser('VET');
    const adminAgent = await signedInAgent(admin.email);

    const res = await adminAgent
      .patch(`/api/admin/vets/${vet.id}/verification`)
      .send({ approved: true });

    expect(res.status).toBe(200);
    expect(res.body.vet).toMatchObject({ userId: vet.id, isVerified: true });
    expect(res.body.vet.verifiedAt).not.toBeNull();

    const vetAgent = await signedInAgent(vet.email);
    const me = await vetAgent.get('/api/auth/me');
    expect(me.body.user.vetProfile.isVerified).toBe(true);
  });

  it('returns 404 for an unknown vet and 422 for an invalid body', async () => {
    const admin = await createUser('ADMIN');
    const agent = await signedInAgent(admin.email);

    const missing = await agent
      .patch('/api/admin/vets/unknown-id/verification')
      .send({ approved: true });
    expect(missing.status).toBe(404);

    const vet = await createUser('VET');
    const invalid = await agent
      .patch(`/api/admin/vets/${vet.id}/verification`)
      .send({ approved: 'yes' });
    expect(invalid.status).toBe(422);
  });
});
