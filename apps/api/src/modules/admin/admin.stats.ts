import { SPECIES, type AdminStats } from '@vetnexa/shared';
import type { PrismaClient } from '../../generated/prisma/client';

const DAY = 24 * 60 * 60 * 1000;
const WEEKS_SHOWN = 8;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - offset * DAY);
}

/** Turns Prisma groupBy rows into { value: count }, including zero for missing values. */
function tally<K extends string>(
  keys: readonly K[],
  rows: { _count: { _all: number } }[],
  key: (row: never) => K,
): Record<K, number> {
  const result = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) result[key(row as never)] = row._count._all;
  return result;
}

/** Platform-wide figures for the admin overview. Counts only, no personal data. */
export async function collectStats(prisma: PrismaClient, now = new Date()): Promise<AdminStats> {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const firstWeek = new Date(weekStart(now).getTime() - (WEEKS_SHOWN - 1) * 7 * DAY);

  const [
    usersByRole,
    suspended,
    newUsers,
    recentSignups,
    vetsVerified,
    vetsPending,
    petsBySpecies,
    clinicsActive,
    clinicsInactive,
    clinicsEmergency,
    consultationsByStatus,
    assessmentsBySeverity,
    referred,
    questions,
    emergencies,
    rescueByStatus,
    adoptionByStatus,
    reviewsHidden,
    reviewsTotal,
    newMessages,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.user.findMany({ where: { createdAt: { gte: firstWeek } }, select: { createdAt: true } }),
    prisma.vetProfile.count({ where: { isVerified: true } }),
    prisma.vetProfile.count({ where: { isVerified: false } }),
    prisma.pet.groupBy({ by: ['species'], _count: { _all: true } }),
    prisma.clinic.count({ where: { isActive: true } }),
    prisma.clinic.count({ where: { isActive: false } }),
    prisma.clinic.count({
      where: { isActive: true, OR: [{ hasEmergency: true }, { isOpen24Hours: true }] },
    }),
    prisma.consultation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.woundAssessment.groupBy({ by: ['severity'], _count: { _all: true } }),
    prisma.woundAssessment.count({ where: { referToVet: true } }),
    prisma.chatMessage.count({ where: { sender: 'USER' } }),
    prisma.chatMessage.count({
      where: { sender: 'ASSISTANT', payload: { path: '$.kind', equals: 'emergency' } },
    }),
    prisma.rescueReport.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.adoptionListing.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.review.count({ where: { status: 'REJECTED' } }),
    prisma.review.count(),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
  ]);

  const byRole = tally(
    ['OWNER', 'VET', 'RESCUER', 'ADMIN'] as const,
    usersByRole,
    (r: (typeof usersByRole)[number]) => r.role,
  );
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = new Date(firstWeek.getTime() + i * 7 * DAY);
    return { weekStart: start.toISOString().slice(0, 10), count: 0 };
  });
  for (const { createdAt } of recentSignups) {
    const index = Math.floor((createdAt.getTime() - firstWeek.getTime()) / (7 * DAY));
    if (weeks[index]) weeks[index].count += 1;
  }
  const rescue = tally(
    ['OPEN', 'IN_PROGRESS', 'RESCUED', 'CLOSED'] as const,
    rescueByStatus,
    (r: (typeof rescueByStatus)[number]) => r.status,
  );
  const adoption = tally(
    ['AVAILABLE', 'PENDING', 'ADOPTED', 'WITHDRAWN'] as const,
    adoptionByStatus,
    (r: (typeof adoptionByStatus)[number]) => r.status,
  );
  const consultations = tally(
    ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const,
    consultationsByStatus,
    (r: (typeof consultationsByStatus)[number]) => r.status,
  );
  const severity = tally(
    ['MINOR', 'MODERATE', 'SEVERE', 'UNCERTAIN'] as const,
    assessmentsBySeverity,
    (r: (typeof assessmentsBySeverity)[number]) => r.severity,
  );
  const species = tally(SPECIES, petsBySpecies, (r: (typeof petsBySpecies)[number]) => r.species);
  const sum = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);

  return {
    generatedAt: now.toISOString(),
    users: {
      total: sum(byRole),
      suspended,
      byRole,
      newLast30Days: newUsers,
      signupsByWeek: weeks,
    },
    vets: { verified: vetsVerified, pending: vetsPending },
    pets: { total: sum(species), bySpecies: species },
    clinics: { active: clinicsActive, inactive: clinicsInactive, emergency: clinicsEmergency },
    consultations: { total: sum(consultations), byStatus: consultations },
    assessments: { total: sum(severity), bySeverity: severity, referredToVet: referred },
    assistant: { questions, emergencies },
    rescue: { open: rescue.OPEN + rescue.IN_PROGRESS, rescued: rescue.RESCUED, total: sum(rescue) },
    adoption: {
      available: adoption.AVAILABLE,
      pending: adoption.PENDING,
      adopted: adoption.ADOPTED,
    },
    moderation: { reviewsHidden, reviewsTotal, newMessages },
  };
}
