import type { HealthRecordData } from '@vetnexa/shared';
import type { HealthRecord, PrismaClient, User } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { currentDueItems } from './due-items';

type RecordWithAuthor = HealthRecord & {
  createdBy: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
};

const dateOnly = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
const authorSelect = { select: { id: true, firstName: true, lastName: true, role: true } };

/**
 * Shapes a record for the API. `canEdit` tells the app whether to show edit/delete buttons:
 * owners may change records they entered themselves, but not ones written by a veterinarian.
 */
export function toRecordResponse(record: RecordWithAuthor, viewerId: string) {
  return {
    id: record.id,
    petId: record.petId,
    type: record.type,
    title: record.title,
    description: record.description,
    recordDate: dateOnly(record.recordDate)!,
    nextDueDate: dateOnly(record.nextDueDate),
    vetName: record.vetName,
    clinicName: record.clinicName,
    createdBy: record.createdBy
      ? {
          id: record.createdBy.id,
          name: `${record.createdBy.role === 'VET' ? 'Dr. ' : ''}${record.createdBy.firstName} ${record.createdBy.lastName}`,
          role: record.createdBy.role,
        }
      : null,
    canEdit: record.createdBy?.id === viewerId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toColumns(data: HealthRecordData) {
  return {
    type: data.type,
    title: data.title,
    description: data.description ?? null,
    recordDate: new Date(data.recordDate),
    nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
    vetName: data.vetName ?? null,
    clinicName: data.clinicName ?? null,
  };
}

/** Days of notice before something is due, used for reminders. */
export const REMINDER_WINDOW_DAYS = 60;

export function recordsService(prisma: PrismaClient) {
  /** Pets are private: another owner's pet is reported as not found. */
  async function assertOwnsPet(ownerId: string, petId: string) {
    const pet = await prisma.pet.findFirst({ where: { id: petId, ownerId }, select: { id: true } });
    if (!pet) throw HttpError.notFound('Pet not found');
  }

  /** Loads a record of the owner's pet that the user is allowed to change. */
  async function findEditableRecord(userId: string, petId: string, recordId: string) {
    await assertOwnsPet(userId, petId);
    const record = await prisma.healthRecord.findFirst({ where: { id: recordId, petId } });
    if (!record) throw HttpError.notFound('Health record not found');
    if (record.createdById !== userId) {
      throw HttpError.forbidden(
        'This record was added by a veterinarian and can only be changed by them.',
      );
    }
    return record;
  }

  return {
    async list(userId: string, petId: string) {
      await assertOwnsPet(userId, petId);
      const records = await prisma.healthRecord.findMany({
        where: { petId },
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
        include: { createdBy: authorSelect },
      });
      return records.map((record) => toRecordResponse(record, userId));
    },

    async create(userId: string, petId: string, data: HealthRecordData) {
      await assertOwnsPet(userId, petId);
      const record = await prisma.healthRecord.create({
        data: { ...toColumns(data), petId, createdById: userId },
        include: { createdBy: authorSelect },
      });
      return toRecordResponse(record, userId);
    },

    async update(userId: string, petId: string, recordId: string, data: HealthRecordData) {
      await findEditableRecord(userId, petId, recordId);
      const record = await prisma.healthRecord.update({
        where: { id: recordId },
        data: toColumns(data),
        include: { createdBy: authorSelect },
      });
      return toRecordResponse(record, userId);
    },

    async remove(userId: string, petId: string, recordId: string) {
      await findEditableRecord(userId, petId, recordId);
      await prisma.healthRecord.delete({ where: { id: recordId } });
    },

    /**
     * Upcoming and overdue care across all of an owner's pets.
     *
     * Overdue items and anything due within REMINDER_WINDOW_DAYS, soonest first.
     * See currentDueItems for how repeated items (e.g. yearly vaccines) are handled.
     */
    async reminders(ownerId: string, today = new Date()) {
      const records = await prisma.healthRecord.findMany({
        where: { pet: { ownerId } },
        select: {
          id: true,
          type: true,
          title: true,
          recordDate: true,
          nextDueDate: true,
          createdAt: true,
          pet: { select: { id: true, name: true, species: true, photoUrl: true } },
        },
      });

      const startOfToday = new Date(today.toISOString().slice(0, 10));
      const windowEnd = new Date(startOfToday.getTime() + REMINDER_WINDOW_DAYS * 86_400_000);

      return currentDueItems(records, (record) => record.pet.id)
        .filter((record) => record.nextDueDate <= windowEnd)
        .map((record) => {
          const daysUntilDue = Math.round(
            (record.nextDueDate.getTime() - startOfToday.getTime()) / 86_400_000,
          );
          return {
            recordId: record.id,
            type: record.type,
            title: record.title,
            dueDate: dateOnly(record.nextDueDate)!,
            daysUntilDue,
            status: daysUntilDue < 0 ? ('OVERDUE' as const) : ('UPCOMING' as const),
            pet: record.pet,
          };
        });
    },
  };
}
