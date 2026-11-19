import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../src/modules/auth/session';
import {
  createUser,
  resetDatabase,
  signedInAgent,
  TEST_PASSWORD,
  testApp,
  testPrisma,
} from './helpers';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

const newOwner = {
  firstName: 'Nimali',
  lastName: 'Perera',
  email: 'Nimali@Example.com',
  phone: '0771234567',
  password: 'Secure123',
  confirmPassword: 'Secure123',
};

/** Finds the session cookie in a response's Set-Cookie header. */
function sessionCookie(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

describe('POST /api/auth/register', () => {
  it('creates an owner account, signs them in and never returns the password hash', async () => {
    const res = await request(testApp()).post('/api/auth/register').send(newOwner);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'nimali@example.com',
      fullName: 'Nimali Perera',
      role: 'OWNER',
      vetProfile: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const stored = await testPrisma.user.findUniqueOrThrow({
      where: { email: 'nimali@example.com' },
    });
    expect(stored.passwordHash).not.toBe(newOwner.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it('creates an unverified vet profile when registering as a vet', async () => {
    const res = await request(testApp())
      .post('/api/auth/register')
      .send({
        ...newOwner,
        role: 'VET',
        licenseNumber: 'slvc-2024-0001',
        specialization: 'Surgery',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.vetProfile).toMatchObject({
      licenseNumber: 'SLVC-2024-0001',
      isVerified: false,
    });
  });

  it('rejects a duplicate email with 409', async () => {
    await request(testApp()).post('/api/auth/register').send(newOwner);
    const res = await request(testApp()).post('/api/auth/register').send(newOwner);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('An account with this email already exists');
  });

  it('refuses to create administrator accounts through sign-up', async () => {
    const res = await request(testApp())
      .post('/api/auth/register')
      .send({ ...newOwner, role: 'ADMIN' });

    expect(res.status).toBe(422);
    expect(await testPrisma.user.count()).toBe(0);
  });

  it('returns field-level errors for invalid input', async () => {
    const res = await request(testApp())
      .post('/api/auth/register')
      .send({ ...newOwner, password: 'weak', confirmPassword: 'weak' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual({
      field: 'password',
      message: 'Password must be at least 8 characters',
    });
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials and records the login time', async () => {
    const user = await createUser('OWNER');

    const res = await request(testApp())
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(sessionCookie(res)).toBeDefined();
    const stored = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.lastLoginAt).not.toBeNull();
  });

  it('uses the same message for a wrong password and an unknown email', async () => {
    const user = await createUser('OWNER');
    const app = testApp();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong123' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.vetnexa.lk', password: 'Wrong123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(sessionCookie(wrongPassword)).toBeUndefined();
  });

  it('blocks suspended accounts', async () => {
    const user = await createUser('OWNER', { suspended: true });

    const res = await request(testApp())
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('rate-limits repeated failed attempts', async () => {
    const app = testApp({ rateLimits: true });
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'x@test.vetnexa.lk', password: 'Wrong123' });

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('session handling', () => {
  it('GET /me returns the signed-in user', async () => {
    const user = await createUser('VET', { verifiedVet: true });
    const agent = await signedInAgent(user.email);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, role: 'VET' });
    expect(res.body.user.vetProfile.isVerified).toBe(true);
  });

  it('GET /me returns 401 without a session', async () => {
    const res = await request(testApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const user = await createUser('ADMIN');
    const forged = jwt.sign(
      { sub: user.id, role: 'ADMIN' },
      'attacker-secret-attacker-secret-123',
      {
        issuer: 'vetnexa-api',
      },
    );

    const res = await request(testApp())
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE}=${forged}`);

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const user = await createUser('OWNER');
    const expired = jwt.sign(
      { sub: user.id, role: 'OWNER', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env['JWT_SECRET']!,
      { issuer: 'vetnexa-api' },
    );

    const res = await request(testApp())
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE}=${expired}`);

    expect(res.status).toBe(401);
  });

  it('stops working immediately when an account is suspended', async () => {
    const user = await createUser('OWNER');
    const agent = await signedInAgent(user.email);
    await testPrisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(403);
  });

  it('POST /logout clears the session cookie', async () => {
    const user = await createUser('OWNER');
    const agent = await signedInAgent(user.email);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(sessionCookie(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
