import { z } from 'zod';
import { optionalText } from './auth';

/** A clinic review. One per user per clinic; posting again replaces the earlier review. */
export const reviewSchema = z.object({
  rating: z.coerce
    .number({ error: 'Please choose a star rating' })
    .int()
    .min(1, 'Please choose a star rating')
    .max(5, 'Ratings go from 1 to 5 stars'),
  title: optionalText(120),
  comment: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters about your visit')
    .max(1000, 'Please keep your review under 1000 characters'),
});

export type ReviewInput = z.input<typeof reviewSchema>;
export type ReviewData = z.output<typeof reviewSchema>;

/** Query string accepted by the clinic directory. */
export const clinicSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  service: z.string().trim().max(80).optional(),
  emergency: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  openNow: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z.enum(['rating', 'name']).default('rating'),
});

export type ClinicSearch = z.output<typeof clinicSearchSchema>;

// ─────────────────────────────── Opening hours ───────────────────────────────

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
/** e.g. { mon: "08:30-20:00", sun: "Closed" } */
export type OpeningHours = Partial<Record<WeekDay, string>>;

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Clinics are in Sri Lanka, so "open now" is always worked out in Sri Lankan time. */
export const CLINIC_TIME_ZONE = 'Asia/Colombo';

/** Day of week and minutes since midnight for a moment, in the clinic's time zone. */
export function clinicLocalTime(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = get('weekday').slice(0, 3).toLowerCase() as WeekDay;
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Parses "08:30-20:00" into minutes since midnight; null for "Closed" or malformed values. */
export function parseHours(value: string | undefined) {
  const match = value?.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, oh, om, ch, cm] = match.map(Number);
  const closes = ch! * 60 + cm!;
  // "23:59" means "until the end of the day", so the last minute counts as open too.
  return { opens: oh! * 60 + om!, closes: closes === 23 * 60 + 59 ? 24 * 60 : closes };
}

/**
 * Whether a clinic is open at the given moment.
 * Clinics marked as open 24 hours are always open; otherwise the day's hours are used.
 */
export function isClinicOpen(hours: OpeningHours, isOpen24Hours: boolean, at = new Date()) {
  if (isOpen24Hours) return true;
  const { day, minutes } = clinicLocalTime(at);
  const today = parseHours(hours[day]);
  return today !== null && minutes >= today.opens && minutes < today.closes;
}
