import { z } from 'zod';
import { PET_SEX, SPECIES, SPECIES_ERROR } from '../enums';
import { optionalText, phoneSchema } from './auth';

// ─────────────────────────────── Rescue reports ───────────────────────────────

export const RESCUE_URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RescueUrgency = (typeof RESCUE_URGENCIES)[number];
export const RESCUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESCUED', 'CLOSED'] as const;
export type RescueStatus = (typeof RESCUE_STATUSES)[number];

export const RESCUE_URGENCY_LABELS: Record<RescueUrgency, string> = {
  LOW: 'Low – safe for now',
  MEDIUM: 'Medium – needs help soon',
  HIGH: 'High – injured or in danger',
  CRITICAL: 'Critical – life at risk',
};
export const RESCUE_STATUS_LABELS: Record<RescueStatus, string> = {
  OPEN: 'Waiting for a rescuer',
  IN_PROGRESS: 'Rescue in progress',
  RESCUED: 'Rescued',
  CLOSED: 'Closed',
};

const optionalPhone = phoneSchema.optional().or(z.literal('').transform(() => undefined));

/** Anyone signed in can report an animal that needs help. */
export const rescueReportSchema = z.object({
  species: z.enum(SPECIES, { error: SPECIES_ERROR }),
  title: z
    .string()
    .trim()
    .min(5, 'Please add a short title, e.g. “Injured puppy near bus stand”')
    .max(120),
  description: z
    .string()
    .trim()
    .min(20, 'Please describe the animal and its condition in at least 20 characters')
    .max(2000),
  locationText: z
    .string()
    .trim()
    .min(5, 'Please describe where the animal is so rescuers can find it')
    .max(200),
  city: z.string().trim().min(2, 'Please enter the town or city').max(80),
  urgency: z.enum(RESCUE_URGENCIES).default('MEDIUM'),
  contactPhone: optionalPhone,
});
export type RescueReportInput = z.input<typeof rescueReportSchema>;
export type RescueReportData = z.output<typeof rescueReportSchema>;

export const rescueStatusSchema = z.object({
  status: z.enum(['RESCUED', 'CLOSED']),
});

// ─────────────────────────────── Adoption ───────────────────────────────

export const AGE_GROUPS = ['BABY', 'YOUNG', 'ADULT', 'SENIOR'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  BABY: 'Baby (under 6 months)',
  YOUNG: 'Young (6 months – 2 years)',
  ADULT: 'Adult (2 – 8 years)',
  SENIOR: 'Senior (8 years +)',
};

export const ANIMAL_SIZES = ['Small', 'Medium', 'Large'] as const;
export const ADOPTION_STATUSES = ['AVAILABLE', 'PENDING', 'ADOPTED', 'WITHDRAWN'] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];
export const ADOPTION_STATUS_LABELS: Record<AdoptionStatus, string> = {
  AVAILABLE: 'Available',
  PENDING: 'Adoption pending',
  ADOPTED: 'Adopted',
  WITHDRAWN: 'Withdrawn',
};

/** "yes" / "no" / "" (unknown) from a form, stored as true / false / null. */
const triState = z
  .union([z.boolean(), z.null(), z.enum(['yes', 'no', ''])])
  .optional()
  .transform((value) =>
    value === true || value === 'yes' ? true : value === false || value === 'no' ? false : null,
  );

export const adoptionListingSchema = z.object({
  name: z.string().trim().min(1, 'Please enter the animal’s name').max(60),
  species: z.enum(SPECIES, { error: SPECIES_ERROR }),
  breed: optionalText(80),
  sex: z.enum(PET_SEX).default('UNKNOWN'),
  ageGroup: z.enum(AGE_GROUPS, { error: 'Please choose an age group' }),
  size: z
    .enum(ANIMAL_SIZES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  city: z.string().trim().min(2, 'Please enter the town or city').max(80),
  description: z
    .string()
    .trim()
    .min(30, 'Tell adopters about the animal’s personality in at least 30 characters')
    .max(2000),
  healthSummary: optionalText(1000),
  isVaccinated: z.boolean().default(false),
  isNeutered: z.boolean().default(false),
  goodWithChildren: triState,
  goodWithPets: triState,
});
export type AdoptionListingInput = z.input<typeof adoptionListingSchema>;
export type AdoptionListingData = z.output<typeof adoptionListingSchema>;

export const listingStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'WITHDRAWN']),
});

export const HOME_TYPES = ['Apartment', 'House', 'House with garden', 'Farm or estate'] as const;

export const adoptionApplicationSchema = z.object({
  homeType: z.enum(HOME_TYPES, { error: 'Please choose your type of home' }),
  hasOtherPets: z.boolean().default(false),
  hasChildren: z.boolean().default(false),
  contactPhone: phoneSchema,
  message: z
    .string()
    .trim()
    .min(30, 'Please tell the rescuer about yourself in at least 30 characters')
    .max(1500),
});
export type AdoptionApplicationInput = z.input<typeof adoptionApplicationSchema>;
export type AdoptionApplicationData = z.output<typeof adoptionApplicationSchema>;

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Not successful',
  WITHDRAWN: 'Withdrawn',
};

/** The rescuer's decision on an application. */
export const applicationDecisionSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  rescuerNotes: optionalText(1000),
});
export type ApplicationDecisionData = z.output<typeof applicationDecisionSchema>;
