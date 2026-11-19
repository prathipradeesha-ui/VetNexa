/**
 * Domain enums shared by the web app and the API.
 * The values match the enums in the Prisma schema, so they can be stored directly.
 */

export const USER_ROLES = ['OWNER', 'VET', 'RESCUER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a person may choose when signing up. Admins are created by other admins only. */
export const SELF_REGISTER_ROLES = [
  'OWNER',
  'VET',
  'RESCUER',
] as const satisfies readonly UserRole[];

export const SPECIES = ['DOG', 'CAT', 'RABBIT', 'BIRD', 'OTHER'] as const;
export type Species = (typeof SPECIES)[number];

export const PET_SEX = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export type PetSex = (typeof PET_SEX)[number];

export const HEALTH_RECORD_TYPES = [
  'VACCINATION',
  'TREATMENT',
  'CHECKUP',
  'MEDICATION',
  'ALLERGY',
  'SURGERY',
] as const;
export type HealthRecordType = (typeof HEALTH_RECORD_TYPES)[number];

/** Severity levels returned by the AI wound assessment, from least to most urgent. */
export const WOUND_SEVERITY = ['MINOR', 'MODERATE', 'SEVERE', 'UNCERTAIN'] as const;
export type WoundSeverity = (typeof WOUND_SEVERITY)[number];

/** Human-readable labels for showing roles in the interface. */
export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Pet owner',
  VET: 'Veterinarian',
  RESCUER: 'Rescuer',
  ADMIN: 'Administrator',
};
