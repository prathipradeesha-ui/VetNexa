import { z } from 'zod';
import { PET_SEX, SPECIES } from '../enums';
import { optionalText } from './auth';

/** "YYYY-MM-DD" date that is not in the future. Empty input means "unknown". */
const pastDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'Enter a valid date',
  })
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: 'Enter a valid date',
  })
  .refine((value) => value === undefined || new Date(value) <= new Date(), {
    message: 'Date of birth cannot be in the future',
  })
  .refine((value) => value === undefined || new Date(value) >= new Date('1980-01-01'), {
    message: 'Please check the year',
  });

/** Number typed into a form (string) or sent by the API (number). Blank means "unknown". */
const optionalWeight = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === '') return undefined;
    const weight = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(weight) || weight <= 0 || weight > 150) {
      ctx.addIssue({ code: 'custom', message: 'Enter a weight between 0.1 and 150 kg' });
      return z.NEVER;
    }
    return Math.round(weight * 100) / 100; // stored with two decimal places
  });

/**
 * Pet profile, used for both creating and editing.
 * The same rules run in the browser form and in the API.
 */
export const petSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your pet’s name').max(60),
  species: z.enum(SPECIES, { error: 'Please choose a species' }),
  breed: optionalText(80),
  sex: z.enum(PET_SEX).default('UNKNOWN'),
  dateOfBirth: pastDate,
  weightKg: optionalWeight,
  color: optionalText(60),
  microchipId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.replace(/\s/g, '') : undefined))
    .refine((value) => value === undefined || /^\d{9,15}$/.test(value), {
      message: 'Microchip numbers have 9 to 15 digits',
    }),
  isNeutered: z.boolean().default(false),
  notes: optionalText(1000),
});

export type PetInput = z.input<typeof petSchema>;
export type PetData = z.output<typeof petSchema>;

export const SPECIES_LABELS: Record<(typeof SPECIES)[number], string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  RABBIT: 'Rabbit',
  BIRD: 'Bird',
  OTHER: 'Other',
};

export const PET_SEX_LABELS: Record<(typeof PET_SEX)[number], string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  UNKNOWN: 'Unknown',
};

/**
 * Human-friendly age from a date of birth, e.g. "4 yrs 3 mos", "7 mos" or "3 wks".
 * Returns null when the date of birth is unknown.
 */
export function formatPetAge(dateOfBirth: string | Date | null | undefined, now = new Date()) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;

  if (months < 1) {
    const weeks = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (7 * 86_400_000)));
    return weeks <= 1 ? 'Newborn' : `${weeks} wks`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} mo${months === 1 ? '' : 's'}`;
  const yearText = `${years} yr${years === 1 ? '' : 's'}`;
  return rest ? `${yearText} ${rest} mo${rest === 1 ? '' : 's'}` : yearText;
}
