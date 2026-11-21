import { z } from 'zod';
import { SPECIES, type WoundSeverity } from '../enums';
import { optionalText } from './auth';

/** Species the wound model was designed for. Other species are refused. */
export const ASSESSABLE_SPECIES = SPECIES;

/** Text fields sent with the photo (multipart/form-data) when requesting an assessment. */
export const assessmentRequestSchema = z.object({
  petId: z.string().trim().min(1, 'Please choose which pet the photo is of').max(40),
  ownerNotes: optionalText(1000),
});

export type AssessmentRequest = z.infer<typeof assessmentRequestSchema>;

/** Wound classes in the order the model outputs them, with the wording shown to owners. */
export const WOUND_CLASS_LABELS: Record<string, string> = {
  abrasion: 'Graze or abrasion',
  laceration: 'Cut (laceration)',
  puncture_wound: 'Puncture wound',
  abscess_or_infection: 'Possible abscess or infection',
  healthy_skin: 'No obvious wound',
};

export const SEVERITY_LABELS: Record<WoundSeverity, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
  UNCERTAIN: 'Uncertain',
};

/** Shown on every result, whatever the model says. */
export const ASSESSMENT_DISCLAIMER =
  'This is a preliminary, AI-generated assessment from a research prototype. It is not a ' +
  'diagnosis and does not replace examination by a qualified veterinarian.';

/** One stored assessment as returned by the API. */
export interface WoundAssessmentResult {
  id: string;
  pet: { id: string; name: string; species: string };
  imageUrl: string;
  status: 'ASSESSED' | 'UNCERTAIN';
  predictedClass: string;
  confidence: number;
  severity: WoundSeverity;
  referToVet: boolean;
  escalated: boolean;
  probabilities: Record<string, number>;
  summary: string;
  guidance: string;
  modelVersion: string;
  demoModel: boolean;
  ownerNotes: string | null;
  disclaimer: string;
  createdAt: string;
}

/** Whether the assessment service can be used right now. */
export interface AssessmentServiceStatus {
  available: boolean;
  demoModel: boolean;
  modelVersion: string | null;
}
