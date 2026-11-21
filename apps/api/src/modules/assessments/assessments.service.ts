import {
  ASSESSABLE_SPECIES,
  ASSESSMENT_DISCLAIMER,
  type AssessmentRequest,
  type AssessmentServiceStatus,
  type WoundAssessmentResult,
} from '@vetnexa/shared';
import type { Pet, PrismaClient, WoundAssessment } from '../../generated/prisma/client';
import type { AiClient } from '../../lib/ai-client';
import { HttpError } from '../../lib/http-error';
import { deleteUpload, saveImage } from '../../lib/uploads';

type AssessmentWithPet = WoundAssessment & { pet: Pick<Pet, 'id' | 'name' | 'species'> };

const withPet = { pet: { select: { id: true, name: true, species: true } } } as const;

export function toAssessmentResponse(row: AssessmentWithPet): WoundAssessmentResult {
  return {
    id: row.id,
    pet: row.pet,
    imageUrl: row.imageUrl,
    status: row.status,
    predictedClass: row.predictedClass,
    confidence: Number(row.confidence),
    severity: row.severity,
    referToVet: row.referToVet,
    escalated: row.escalated,
    probabilities: row.probabilities as Record<string, number>,
    summary: row.summary,
    guidance: row.guidance,
    modelVersion: row.modelVersion,
    demoModel: row.demoModel,
    ownerNotes: row.ownerNotes,
    disclaimer: ASSESSMENT_DISCLAIMER,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
}

export function assessmentsService(prisma: PrismaClient, ai: AiClient) {
  /** Only the owner can see an assessment; anything else is reported as "not found". */
  async function findOwned(userId: string, id: string) {
    const row = await prisma.woundAssessment.findFirst({
      where: { id, userId },
      include: withPet,
    });
    if (!row) throw HttpError.notFound('Assessment not found');
    return row;
  }

  return {
    async status(): Promise<AssessmentServiceStatus> {
      try {
        const health = await ai.health();
        return {
          available: health.modelLoaded,
          demoModel: health.demoModel ?? false,
          modelVersion: health.modelVersion,
        };
      } catch {
        return { available: false, demoModel: false, modelVersion: null };
      }
    },

    async create(userId: string, data: AssessmentRequest, photo: UploadedPhoto) {
      const pet = await prisma.pet.findFirst({ where: { id: data.petId, ownerId: userId } });
      if (!pet) throw HttpError.notFound('Pet not found');
      if (!(ASSESSABLE_SPECIES as readonly string[]).includes(pet.species)) {
        const message = 'Wound assessment is only available for dogs and cats';
        throw HttpError.validation([{ field: 'petId', message }], message);
      }

      const result = await ai.assess(photo.buffer, photo.mimetype);

      // A poor photo is not stored: the owner is told how to take a better one.
      if (result.status === 'REJECTED_QUALITY') {
        throw new HttpError(422, 'PHOTO_QUALITY', 'This photo cannot be assessed reliably', {
          problems: result.quality.problems,
        });
      }
      if (result.predictedClass === null || result.confidence === null) {
        throw HttpError.serviceUnavailable('The AI service returned an incomplete result');
      }

      // Stored re-encoded as WebP, which removes location data from phone photos.
      const imageUrl = await saveImage(photo.buffer, { folder: 'wounds', size: 1024 });
      const row = await prisma.woundAssessment.create({
        data: {
          petId: pet.id,
          userId,
          imageUrl,
          status: result.status,
          predictedClass: result.predictedClass,
          confidence: result.confidence,
          severity: result.severity,
          referToVet: result.referToVet,
          escalated: result.escalated,
          probabilities: result.probabilities,
          summary: result.summary.slice(0, 200),
          guidance: result.guidance,
          modelVersion: result.modelVersion.slice(0, 40),
          demoModel: result.demoModel,
          ownerNotes: data.ownerNotes ?? null,
        },
        include: withPet,
      });
      return toAssessmentResponse(row);
    },

    async list(userId: string, petId?: string) {
      const rows = await prisma.woundAssessment.findMany({
        where: { userId, ...(petId && { petId }) },
        orderBy: { createdAt: 'desc' },
        include: withPet,
        take: 100,
      });
      return rows.map(toAssessmentResponse);
    },

    async get(userId: string, id: string) {
      return toAssessmentResponse(await findOwned(userId, id));
    },

    async remove(userId: string, id: string) {
      const row = await findOwned(userId, id);
      await prisma.woundAssessment.delete({ where: { id: row.id } });
      await deleteUpload(row.imageUrl);
    },
  };
}
