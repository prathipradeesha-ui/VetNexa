import type { PetData } from '@vetnexa/shared';
import type { Pet, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { deleteUpload, saveImage } from '../../lib/uploads';

/** Converts database types (Decimal, Date) into plain JSON values for the API response. */
export function toPetResponse(pet: Pet) {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.toISOString().slice(0, 10) : null,
    weightKg: pet.weightKg === null ? null : Number(pet.weightKg),
    color: pet.color,
    microchipId: pet.microchipId,
    isNeutered: pet.isNeutered,
    photoUrl: pet.photoUrl,
    notes: pet.notes,
    createdAt: pet.createdAt,
    updatedAt: pet.updatedAt,
  };
}

/** Maps validated form data to database columns ("unknown" values become null). */
function toPetColumns(data: PetData) {
  return {
    name: data.name,
    species: data.species,
    breed: data.breed ?? null,
    sex: data.sex,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    weightKg: data.weightKg ?? null,
    color: data.color ?? null,
    microchipId: data.microchipId ?? null,
    isNeutered: data.isNeutered,
    notes: data.notes ?? null,
  };
}

export function petsService(prisma: PrismaClient) {
  /**
   * Loads a pet only if it belongs to the given owner.
   * Someone else's pet is reported as "not found" rather than "forbidden", so the API never
   * confirms that a pet ID exists to a user who has no right to see it.
   */
  async function findOwnedPet(ownerId: string, petId: string) {
    const pet = await prisma.pet.findFirst({ where: { id: petId, ownerId } });
    if (!pet) throw HttpError.notFound('Pet not found');
    return pet;
  }

  /** Microchip numbers are unique worldwide, so two pets can never share one. */
  async function assertMicrochipAvailable(microchipId: string | undefined, exceptPetId?: string) {
    if (!microchipId) return;
    const other = await prisma.pet.findUnique({ where: { microchipId } });
    if (other && other.id !== exceptPetId) {
      throw HttpError.conflict('This microchip number is already registered', 'microchipId');
    }
  }

  return {
    async list(ownerId: string) {
      const today = new Date(new Date().toISOString().slice(0, 10));
      const pets = await prisma.pet.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { healthRecords: true } },
          // The next upcoming vaccination, medication or check-up, for the pet cards.
          healthRecords: {
            where: { nextDueDate: { gte: today } },
            orderBy: { nextDueDate: 'asc' },
            take: 1,
            select: { title: true, type: true, nextDueDate: true },
          },
        },
      });

      return pets.map(({ _count, healthRecords, ...pet }) => ({
        ...toPetResponse(pet),
        recordCount: _count.healthRecords,
        nextDue: healthRecords[0]
          ? {
              title: healthRecords[0].title,
              type: healthRecords[0].type,
              date: healthRecords[0].nextDueDate!.toISOString().slice(0, 10),
            }
          : null,
      }));
    },

    async get(ownerId: string, petId: string) {
      return toPetResponse(await findOwnedPet(ownerId, petId));
    },

    async create(ownerId: string, data: PetData) {
      await assertMicrochipAvailable(data.microchipId);
      const pet = await prisma.pet.create({ data: { ...toPetColumns(data), ownerId } });
      return toPetResponse(pet);
    },

    async update(ownerId: string, petId: string, data: PetData) {
      await findOwnedPet(ownerId, petId);
      await assertMicrochipAvailable(data.microchipId, petId);
      const pet = await prisma.pet.update({ where: { id: petId }, data: toPetColumns(data) });
      return toPetResponse(pet);
    },

    async remove(ownerId: string, petId: string) {
      const pet = await findOwnedPet(ownerId, petId);
      // Health records and assessments are removed with the pet (onDelete: Cascade).
      await prisma.pet.delete({ where: { id: petId } });
      await deleteUpload(pet.photoUrl);
    },

    async setPhoto(ownerId: string, petId: string, image: Buffer) {
      const existing = await findOwnedPet(ownerId, petId);
      const photoUrl = await saveImage(image, { folder: 'pets' });
      const pet = await prisma.pet.update({ where: { id: petId }, data: { photoUrl } });
      await deleteUpload(existing.photoUrl); // only after the new photo is safely saved
      return toPetResponse(pet);
    },

    async removePhoto(ownerId: string, petId: string) {
      const existing = await findOwnedPet(ownerId, petId);
      const pet = await prisma.pet.update({ where: { id: petId }, data: { photoUrl: null } });
      await deleteUpload(existing.photoUrl);
      return toPetResponse(pet);
    },
  };
}
