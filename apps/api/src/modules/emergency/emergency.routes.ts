import {
  ASSESSMENT_DISCLAIMER,
  guestAssessmentRequestSchema,
  guestRescueReportSchema,
  type GuestAssessmentRequest,
  type GuestAssessmentResult,
  type GuestRescueReportData,
} from '@vetnexa/shared';
import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client';
import type { AiClient } from '../../lib/ai-client';
import { HttpError } from '../../lib/http-error';
import { singleImage } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { rescueService } from '../rescue/rescue.service';

/**
 * /api/emergency – essential help without an account, for emergencies.
 *
 *   GET  /status   whether the wound check is available (and if a demo model is running)
 *   POST /assess   wound check: multipart "photo", "species" (DOG or CAT), optional "answers"
 *   POST /rescue   report an animal in need with a name and a contact phone
 *
 * Privacy: the wound check result is returned to the person and NOT stored, and the photo is
 * not saved. Both routes are rate limited per IP address, because there is no account.
 */
export function emergencyRouter(
  prisma: PrismaClient,
  ai: AiClient,
  assessLimiter: RequestHandler,
  rescueLimiter: RequestHandler,
) {
  const router = Router();
  const rescue = rescueService(prisma);

  /** Whether the wound check can be used, and whether a demonstration model is running. */
  router.get('/status', async (_req, res) => {
    try {
      const health = await ai.health();
      res.json({
        available: health.modelLoaded,
        demoModel: health.demoModel ?? false,
        modelVersion: health.modelVersion,
      });
    } catch {
      res.json({ available: false, demoModel: false, modelVersion: null });
    }
  });

  router.post(
    '/assess',
    assessLimiter,
    singleImage('photo'),
    validate(guestAssessmentRequestSchema),
    async (req, res) => {
      const { species, answers } = res.locals['body'] as GuestAssessmentRequest;
      const context = answers ? { ...answers, species: species.toLowerCase() } : undefined;
      const result = await ai.assess(req.file!.buffer, req.file!.mimetype, context);

      if (result.status === 'REJECTED_QUALITY') {
        throw new HttpError(422, 'PHOTO_QUALITY', 'This photo cannot be assessed reliably', {
          problems: result.quality.problems,
        });
      }
      if (result.predictedClass === null || result.confidence === null) {
        throw HttpError.serviceUnavailable('The AI service returned an incomplete result');
      }

      const assessment: GuestAssessmentResult = {
        species,
        status: result.status,
        predictedClass: result.predictedClass,
        confidence: result.confidence,
        severity: result.severity,
        referToVet: result.referToVet,
        escalated: result.escalated,
        probabilities: result.probabilities,
        summary: result.summary,
        guidance: result.guidance,
        modelVersion: result.modelVersion,
        demoModel: result.demoModel,
        answers: (answers as GuestAssessmentResult['answers']) ?? null,
        symptoms: result.symptoms ?? null,
        disclaimer: ASSESSMENT_DISCLAIMER,
      };
      res.json({ assessment, stored: false });
    },
  );

  router.post('/rescue', rescueLimiter, validate(guestRescueReportSchema), async (_req, res) => {
    const report = await rescue.createAsGuest(res.locals['body'] as GuestRescueReportData);
    res.status(201).json({ report });
  });

  return router;
}
