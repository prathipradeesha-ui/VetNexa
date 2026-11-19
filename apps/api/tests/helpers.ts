import request from 'supertest';
import { createApp, type AppDependencies } from '../src/app';
import type { UserRole } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/lib/prisma';
import { hashPassword } from '../src/modules/auth/password';

/** Prisma client connected to the test database (DATABASE_URL is set by vitest.config.ts). */
export const testPrisma = createPrismaClient();

/** A fully configured app wired to the test database. */
export const testApp = (options: Partial<AppDependencies> = {}) =>
  createApp({ prisma: testPrisma, ...options });

export const TEST_PASSWORD = 'Password123';

/** Empties every table, children first, so each test starts from a known state. */
export async function resetDatabase() {
  await testPrisma.chatMessage.deleteMany();
  await testPrisma.adoptionApplication.deleteMany();
  await testPrisma.adoptionListing.deleteMany();
  await testPrisma.rescueReport.deleteMany();
  await testPrisma.review.deleteMany();
  await testPrisma.consultation.deleteMany();
  await testPrisma.woundAssessment.deleteMany();
  await testPrisma.healthRecord.deleteMany();
  await testPrisma.pet.deleteMany();
  await testPrisma.vetProfile.deleteMany();
  await testPrisma.clinic.deleteMany();
  await testPrisma.user.deleteMany();
}

let userCounter = 0;
// Hashing is slow by design, so the test password is hashed once and reused.
let passwordHashPromise: Promise<string> | undefined;

/** Creates a user directly in the database. */
export async function createUser(
  role: UserRole = 'OWNER',
  overrides: { verifiedVet?: boolean; suspended?: boolean } = {},
) {
  userCounter += 1;
  passwordHashPromise ??= hashPassword(TEST_PASSWORD);
  return testPrisma.user.create({
    data: {
      email: `${role.toLowerCase()}${userCounter}@test.vetnexa.lk`,
      passwordHash: await passwordHashPromise,
      firstName: 'Test',
      lastName: role.charAt(0) + role.slice(1).toLowerCase(),
      role,
      status: overrides.suspended ? 'SUSPENDED' : 'ACTIVE',
      ...(role === 'VET' && {
        vetProfile: {
          create: {
            licenseNumber: `TEST-${userCounter}`,
            isVerified: overrides.verifiedVet ?? false,
          },
        },
      }),
    },
  });
}

/** Returns a Supertest agent that is already signed in as the given user (cookie kept). */
export async function signedInAgent(email: string, options: Partial<AppDependencies> = {}) {
  const agent = request.agent(testApp(options));
  const res = await agent.post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return agent;
}
