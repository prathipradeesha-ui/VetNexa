import { z } from 'zod';
import { optionalText } from './auth';
import { CLINIC_TIME_ZONE } from './clinic';

export const CONSULTATION_TYPES = ['IN_PERSON', 'VIDEO'] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

export const CONSULTATION_STATUSES = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  IN_PERSON: 'In person',
  VIDEO: 'Video call',
};

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  REQUESTED: 'Awaiting confirmation',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Appointments can be booked between these hours (Sri Lanka time), on the half hour. */
export const BOOKING_HOURS = { first: '08:00', last: '19:30' } as const;
export const MAX_DAYS_AHEAD = 60;
/** Two appointments with the same vet must be at least this far apart. */
export const APPOINTMENT_MINUTES = 30;

// ─────────────────────────────── Sri Lanka date and time ───────────────────────────────

/** Turns a date and time picked in Sri Lanka (UTC+05:30, no daylight saving) into a UTC ISO string. */
export function colomboToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

/** Splits an instant into Sri Lankan "YYYY-MM-DD" and "HH:MM", e.g. to fill a form. */
export function isoToColombo(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** "Thu 26 Nov 2026, 4:00 pm" in Sri Lanka time. */
export function formatAppointment(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

// ─────────────────────────────── Schemas ───────────────────────────────

/** An owner's request for a consultation. The date and time are entered in Sri Lanka time. */
export const consultationRequestSchema = z
  .object({
    petId: z.string().min(1, 'Please choose a pet'),
    vetId: z.string().min(1, 'Please choose a veterinarian'),
    type: z.enum(CONSULTATION_TYPES).default('IN_PERSON'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please choose a date'),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):(00|30)$/, 'Please choose a time')
      .refine((time) => time >= BOOKING_HOURS.first && time <= BOOKING_HOURS.last, {
        message: 'Appointments are available from 8.00 am to 7.30 pm',
      }),
    reason: z
      .string()
      .trim()
      .min(10, 'Please describe the reason in at least 10 characters')
      .max(1000),
  })
  .superRefine((data, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return;
    const at = new Date(colomboToIso(data.date, data.time || '00:00')).getTime();
    const now = Date.now();
    if (at < now + 60 * 60 * 1000) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'Please choose a time at least one hour from now',
      });
    } else if (at > now + MAX_DAYS_AHEAD * 86_400_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: `Appointments can be booked up to ${MAX_DAYS_AHEAD} days ahead`,
      });
    }
  });

export type ConsultationRequestInput = z.input<typeof consultationRequestSchema>;
export type ConsultationRequestData = z.output<typeof consultationRequestSchema>;

/** Status changes. Completing a consultation uses consultationOutcomeSchema instead. */
export const consultationStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  note: optionalText(500),
});
export type ConsultationStatusData = z.output<typeof consultationStatusSchema>;

/** What the vet records when completing a consultation. */
export const consultationOutcomeSchema = z.object({
  diagnosis: z.string().trim().min(3, 'Please enter the diagnosis or findings').max(2000),
  treatment: z.string().trim().min(3, 'Please enter the treatment or advice given').max(2000),
  vetNotes: optionalText(2000),
  followUpDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter a valid date',
    })
    .refine((value) => value === undefined || value > new Date().toISOString().slice(0, 10), {
      message: 'The follow-up date must be in the future',
    }),
});
export type ConsultationOutcomeInput = z.input<typeof consultationOutcomeSchema>;
export type ConsultationOutcomeData = z.output<typeof consultationOutcomeSchema>;
