import { z } from 'zod';
import { HEALTH_RECORD_TYPES, type HealthRecordType } from '../enums';
import { optionalText } from './auth';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * One entry in a pet's medical history.
 * - `recordDate` is when it happened (cannot be in the future).
 * - `nextDueDate` is optional and drives reminders, e.g. the next booster.
 */
export const healthRecordSchema = z
  .object({
    type: z.enum(HEALTH_RECORD_TYPES, { error: 'Please choose a record type' }),
    title: z.string().trim().min(2, 'Please describe the record, e.g. “Rabies vaccine”').max(120),
    description: optionalText(2000),
    recordDate: z
      .string()
      .trim()
      .regex(isoDate, 'Enter the date it happened')
      .refine((value) => value <= todayIso(), { message: 'This date cannot be in the future' }),
    nextDueDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined))
      .refine((value) => value === undefined || isoDate.test(value), {
        message: 'Enter a valid date',
      }),
    vetName: optionalText(120),
    clinicName: optionalText(120),
  })
  .superRefine((data, ctx) => {
    if (data.nextDueDate && data.nextDueDate <= data.recordDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'The next due date must be after the record date',
        path: ['nextDueDate'],
      });
    }
  });

export type HealthRecordInput = z.input<typeof healthRecordSchema>;
export type HealthRecordData = z.output<typeof healthRecordSchema>;

export const HEALTH_RECORD_LABELS: Record<HealthRecordType, string> = {
  VACCINATION: 'Vaccination',
  TREATMENT: 'Treatment',
  CHECKUP: 'Check-up',
  MEDICATION: 'Medication',
  ALLERGY: 'Allergy',
  SURGERY: 'Surgery',
};

/** Record types that usually repeat, so the form suggests a "next due" date for them. */
export const RECURRING_RECORD_TYPES: readonly HealthRecordType[] = [
  'VACCINATION',
  'MEDICATION',
  'CHECKUP',
];
