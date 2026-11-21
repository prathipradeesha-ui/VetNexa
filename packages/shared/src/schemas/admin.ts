import { z } from 'zod';
import { USER_ROLES } from '../enums';
import { optionalText } from './auth';
import { WEEK_DAYS } from './clinic';

// ─────────────────────────────── Users ───────────────────────────────

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Filters for the admin user list. Empty strings from form selects mean "any". */
export const adminUserQuerySchema = z.object({
  q: optionalText(80),
  role: z
    .enum([...USER_ROLES, ''])
    .optional()
    .transform((v) => v || undefined),
  status: z
    .enum([...ACCOUNT_STATUSES, ''])
    .optional()
    .transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type AdminUserQuery = z.output<typeof adminUserQuerySchema>;

export const accountStatusSchema = z.object({ status: z.enum(ACCOUNT_STATUSES) });

// ─────────────────────────────── Clinics ───────────────────────────────

/** Sri Lankan landline or mobile: 0XXXXXXXXX or +94XXXXXXXXX. */
export const clinicPhoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)\d{9}$/, 'Enter a valid phone number, for example 0112574410');

/** "08:30-20:00" or "Closed". */
const hoursPattern = /^(Closed|([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d)$/;

const hoursField = z
  .string()
  .trim()
  .regex(hoursPattern, 'Use HH:MM-HH:MM, for example 08:30-20:00, or "Closed"')
  .refine(
    (value) => value === 'Closed' || value.slice(0, 5) < value.slice(6),
    'Closing time must be after opening time',
  );

const optionalUrl = z
  .string()
  .trim()
  .max(191)
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.url({ protocol: /^https?$/, error: 'Enter a full web address (https://…)' }).optional());

const optionalCoordinate = (min: number, max: number, label: string) =>
  z
    .union([z.number(), z.string().trim()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= min && v <= max), {
      message: `Enter a valid ${label}`,
    });

/** Create or edit a clinic in the directory. */
export const clinicFormSchema = z.object({
  name: z.string().trim().min(3, 'Enter the clinic name').max(120),
  description: optionalText(2000),
  addressLine: z.string().trim().min(5, 'Enter the street address').max(200),
  city: z.string().trim().min(2, 'Enter the town or city').max(80),
  district: z.string().trim().min(2, 'Enter the district').max(80),
  latitude: optionalCoordinate(5.5, 10.0, 'latitude in Sri Lanka'),
  longitude: optionalCoordinate(79.4, 82.0, 'longitude in Sri Lanka'),
  phone: clinicPhoneSchema,
  email: z
    .string()
    .trim()
    .max(191)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email('Enter a valid email address').optional()),
  website: optionalUrl,
  services: z
    .array(z.string().trim().min(2).max(60))
    .min(1, 'Add at least one service')
    .max(20, 'Add at most 20 services')
    .transform((list) => [...new Set(list)]),
  openingHours: z.object(
    Object.fromEntries(WEEK_DAYS.map((day) => [day, hoursField])) as Record<
      (typeof WEEK_DAYS)[number],
      typeof hoursField
    >,
  ),
  hasEmergency: z.boolean().default(false),
  isOpen24Hours: z.boolean().default(false),
});
export type ClinicFormInput = z.input<typeof clinicFormSchema>;
export type ClinicFormData = z.output<typeof clinicFormSchema>;

export const clinicActiveSchema = z.object({ isActive: z.boolean() });

// ─────────────────────────────── Content ───────────────────────────────

export const MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
/** Admins approve (show) or reject (hide) a review. */
export const reviewModerationSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });

export const CONTACT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};
export const contactStatusSchema = z.object({ status: z.enum(CONTACT_STATUSES) });

export const contentQuerySchema = z.object({
  status: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

// ─────────────────────────────── Statistics ───────────────────────────────

export interface AdminStats {
  generatedAt: string;
  users: {
    total: number;
    suspended: number;
    byRole: Record<string, number>;
    newLast30Days: number;
    /** Sign-ups per week for the last 8 weeks, oldest first. */
    signupsByWeek: { weekStart: string; count: number }[];
  };
  vets: { verified: number; pending: number };
  pets: { total: number; bySpecies: Record<string, number> };
  clinics: { active: number; inactive: number; emergency: number };
  consultations: { total: number; byStatus: Record<string, number> };
  assessments: { total: number; bySeverity: Record<string, number>; referredToVet: number };
  assistant: { questions: number; emergencies: number };
  rescue: { open: number; rescued: number; total: number };
  adoption: { available: number; pending: number; adopted: number };
  moderation: { reviewsHidden: number; reviewsTotal: number; newMessages: number };
}
