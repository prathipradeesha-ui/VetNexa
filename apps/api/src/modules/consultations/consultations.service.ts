import {
  APPOINTMENT_MINUTES,
  colomboToIso,
  isoToColombo,
  type ConsultationOutcomeData,
  type ConsultationRequestData,
  type ConsultationStatusData,
} from '@vetnexa/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import type { AuthUser } from '../../types/express';
import { toRecordResponse } from '../records/records.service';

const include = {
  pet: {
    select: { id: true, name: true, species: true, breed: true, photoUrl: true, dateOfBirth: true },
  },
  owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  vet: { select: { id: true, firstName: true, lastName: true } },
  clinic: { select: { id: true, name: true, slug: true, phone: true, city: true } },
} satisfies Prisma.ConsultationInclude;

type ConsultationRow = Prisma.ConsultationGetPayload<{ include: typeof include }>;

const ACTIVE: ConsultationRow['status'][] = ['REQUESTED', 'CONFIRMED'];

/**
 * Shapes a consultation for the viewer and lists the actions they may take, so the app shows
 * exactly the buttons the API will accept. Owner contact details are only sent to the vet.
 */
export function toConsultationResponse(row: ConsultationRow, viewer: AuthUser) {
  const isVet = viewer.role === 'VET' && row.vetId === viewer.id;
  const isOwner = row.ownerId === viewer.id;
  const active = ACTIVE.includes(row.status);
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    scheduledAt: row.scheduledAt.toISOString(),
    reason: row.reason,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    vetNotes: row.vetNotes,
    followUpAt: row.followUpAt?.toISOString() ?? null,
    pet: {
      ...row.pet,
      dateOfBirth: row.pet.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    },
    vet: row.vet ? { id: row.vet.id, name: `Dr. ${row.vet.firstName} ${row.vet.lastName}` } : null,
    clinic: row.clinic,
    owner: isVet
      ? {
          name: `${row.owner.firstName} ${row.owner.lastName}`,
          phone: row.owner.phone,
          email: row.owner.email,
        }
      : null,
    actions: {
      canConfirm: isVet && row.status === 'REQUESTED',
      canComplete: isVet && row.status === 'CONFIRMED',
      canCancel: (isVet || isOwner) && active,
      canViewPatient: isVet && row.status !== 'CANCELLED',
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export type ListView = 'upcoming' | 'requests' | 'past' | 'all';

export function consultationsService(prisma: PrismaClient) {
  /** Loads a consultation the viewer takes part in; anyone else gets "not found". */
  async function findForViewer(viewer: AuthUser, id: string) {
    const row = await prisma.consultation.findFirst({
      where: { id, OR: [{ ownerId: viewer.id }, { vetId: viewer.id }] },
      include,
    });
    if (!row) throw HttpError.notFound('Consultation not found');
    return row;
  }

  return {
    async list(viewer: AuthUser, view: ListView) {
      const now = new Date();
      const where: Prisma.ConsultationWhereInput =
        viewer.role === 'VET' ? { vetId: viewer.id } : { ownerId: viewer.id };
      if (view === 'requests') where.status = 'REQUESTED';
      if (view === 'upcoming')
        Object.assign(where, { status: { in: ACTIVE }, scheduledAt: { gte: now } });
      if (view === 'past') {
        where.OR = [{ status: { in: ['COMPLETED', 'CANCELLED'] } }, { scheduledAt: { lt: now } }];
      }
      const rows = await prisma.consultation.findMany({
        where,
        include,
        orderBy: { scheduledAt: view === 'past' ? 'desc' : 'asc' },
        take: 100,
      });
      return rows.map((row) => toConsultationResponse(row, viewer));
    },

    async get(viewer: AuthUser, id: string) {
      return toConsultationResponse(await findForViewer(viewer, id), viewer);
    },

    async request(owner: AuthUser, data: ConsultationRequestData) {
      const pet = await prisma.pet.findFirst({ where: { id: data.petId, ownerId: owner.id } });
      if (!pet) throw HttpError.notFound('Pet not found');

      const vet = await prisma.user.findFirst({
        where: { id: data.vetId, role: 'VET', status: 'ACTIVE', vetProfile: { isVerified: true } },
        include: { vetProfile: true },
      });
      if (!vet) {
        throw HttpError.validation([
          { field: 'vetId', message: 'This veterinarian is not available for bookings' },
        ]);
      }

      // One appointment per vet per 30-minute slot.
      const scheduledAt = new Date(colomboToIso(data.date, data.time));
      const windowMs = APPOINTMENT_MINUTES * 60 * 1000;
      const clash = await prisma.consultation.findFirst({
        where: {
          vetId: vet.id,
          status: { in: ACTIVE },
          scheduledAt: {
            gt: new Date(scheduledAt.getTime() - windowMs),
            lt: new Date(scheduledAt.getTime() + windowMs),
          },
        },
      });
      if (clash) {
        throw HttpError.conflict(
          `Dr. ${vet.lastName} is already booked at this time. Please choose another time.`,
          'time',
        );
      }

      const row = await prisma.consultation.create({
        data: {
          petId: pet.id,
          ownerId: owner.id,
          vetId: vet.id,
          clinicId: vet.vetProfile?.clinicId ?? null,
          type: data.type,
          scheduledAt,
          reason: data.reason,
        },
        include,
      });
      return toConsultationResponse(row, owner);
    },

    /**
     * Allowed changes:
     *   vet:   REQUESTED → CONFIRMED,  REQUESTED/CONFIRMED → CANCELLED
     *   owner: REQUESTED/CONFIRMED → CANCELLED
     */
    async setStatus(viewer: AuthUser, id: string, change: ConsultationStatusData) {
      const row = await findForViewer(viewer, id);
      const actions = toConsultationResponse(row, viewer).actions;
      const allowed = change.status === 'CONFIRMED' ? actions.canConfirm : actions.canCancel;
      if (!allowed) {
        throw HttpError.conflict(
          `This consultation is ${row.status.toLowerCase()} and cannot be ${change.status === 'CONFIRMED' ? 'confirmed' : 'cancelled'}.`,
        );
      }
      const note =
        change.status === 'CANCELLED' && change.note
          ? `Cancelled by ${viewer.role === 'VET' ? 'the veterinarian' : 'the owner'}: ${change.note}`
          : row.vetNotes;
      const updated = await prisma.consultation.update({
        where: { id },
        data: { status: change.status, vetNotes: note },
        include,
      });
      return toConsultationResponse(updated, viewer);
    },

    /**
     * The vet records the outcome. In the same transaction a health record is added to the
     * pet's history, authored by the vet, so the owner can read it but not change it.
     */
    async complete(vet: AuthUser, id: string, outcome: ConsultationOutcomeData) {
      const row = await findForViewer(vet, id);
      if (!toConsultationResponse(row, vet).actions.canComplete) {
        throw HttpError.conflict('Only confirmed consultations can be completed.');
      }
      const visitDate = new Date(isoToColombo(row.scheduledAt.toISOString()).date);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.healthRecord.create({
          data: {
            petId: row.petId,
            type: 'TREATMENT',
            title: `Consultation: ${outcome.diagnosis}`.slice(0, 120),
            description: `Reason: ${row.reason}\nFindings: ${outcome.diagnosis}\nTreatment: ${outcome.treatment}`,
            recordDate: visitDate,
            nextDueDate: outcome.followUpDate ? new Date(outcome.followUpDate) : null,
            vetName: row.vet ? `Dr. ${row.vet.firstName} ${row.vet.lastName}` : null,
            clinicName: row.clinic?.name ?? null,
            createdById: vet.id,
          },
        });
        return tx.consultation.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            diagnosis: outcome.diagnosis,
            treatment: outcome.treatment,
            vetNotes: outcome.vetNotes ?? null,
            followUpAt: outcome.followUpDate
              ? new Date(colomboToIso(outcome.followUpDate, '09:00'))
              : null,
          },
          include,
        });
      });
      return toConsultationResponse(updated, vet);
    },

    /**
     * A vet can open a pet's profile and full history only while they have a
     * consultation with it that was not cancelled.
     */
    async patient(vet: AuthUser, petId: string) {
      const link = await prisma.consultation.findFirst({
        where: { petId, vetId: vet.id, status: { not: 'CANCELLED' } },
        select: { id: true },
      });
      if (!link) throw HttpError.notFound('Patient not found');

      const pet = await prisma.pet.findUniqueOrThrow({
        where: { id: petId },
        include: {
          owner: { select: { firstName: true, lastName: true, phone: true } },
          healthRecords: {
            orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
            include: {
              createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
            },
          },
        },
      });
      return {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        sex: pet.sex,
        dateOfBirth: pet.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        weightKg: pet.weightKg === null ? null : Number(pet.weightKg),
        microchipId: pet.microchipId,
        isNeutered: pet.isNeutered,
        photoUrl: pet.photoUrl,
        notes: pet.notes,
        owner: { name: `${pet.owner.firstName} ${pet.owner.lastName}`, phone: pet.owner.phone },
        records: pet.healthRecords.map((record) => toRecordResponse(record, vet.id)),
      };
    },

    /** Numbers and today's schedule for the vet dashboard (days in Sri Lanka time). */
    async vetSummary(vet: AuthUser, now = new Date()) {
      const today = isoToColombo(now.toISOString()).date;
      const startOfToday = new Date(colomboToIso(today, '00:00'));
      const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
      const inSevenDays = new Date(startOfToday.getTime() + 7 * 86_400_000);
      const startOfMonth = new Date(colomboToIso(`${today.slice(0, 7)}-01`, '00:00'));

      const [pendingRequests, upcomingWeek, completedThisMonth, todayRows] = await Promise.all([
        prisma.consultation.count({ where: { vetId: vet.id, status: 'REQUESTED' } }),
        prisma.consultation.count({
          where: {
            vetId: vet.id,
            status: { in: ACTIVE },
            scheduledAt: { gte: now, lt: inSevenDays },
          },
        }),
        prisma.consultation.count({
          where: { vetId: vet.id, status: 'COMPLETED', scheduledAt: { gte: startOfMonth } },
        }),
        prisma.consultation.findMany({
          where: {
            vetId: vet.id,
            status: { not: 'CANCELLED' },
            scheduledAt: { gte: startOfToday, lt: startOfTomorrow },
          },
          include,
          orderBy: { scheduledAt: 'asc' },
        }),
      ]);
      return {
        pendingRequests,
        upcomingWeek,
        completedThisMonth,
        today: todayRows.map((row) => toConsultationResponse(row, vet)),
      };
    },

    /** Verified vets that owners can book, with their clinic. */
    async bookableVets() {
      const vets = await prisma.user.findMany({
        where: { role: 'VET', status: 'ACTIVE', vetProfile: { isVerified: true } },
        orderBy: { lastName: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          vetProfile: {
            select: {
              specialization: true,
              yearsExperience: true,
              clinic: { select: { id: true, name: true, city: true } },
            },
          },
        },
      });
      return vets.map((vet) => ({
        id: vet.id,
        name: `Dr. ${vet.firstName} ${vet.lastName}`,
        specialization: vet.vetProfile?.specialization ?? null,
        yearsExperience: vet.vetProfile?.yearsExperience ?? null,
        clinic: vet.vetProfile?.clinic ?? null,
      }));
    },
  };
}
