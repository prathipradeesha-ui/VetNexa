import { z } from 'zod';
import { optionalText } from './auth';

/**
 * Follow-up check-ins after a wound check: the owner picks when to look at the wound again,
 * then records whether it is better, the same or worse. "Worse" always means seeing a vet.
 */

/** How many days after the check the owner can ask to be reminded. */
export const FOLLOW_UP_DAYS = [1, 2, 3, 7] as const;

export const FOLLOW_UP_PROGRESS = ['BETTER', 'SAME', 'WORSE'] as const;
export type FollowUpProgress = (typeof FOLLOW_UP_PROGRESS)[number];

export const FOLLOW_UP_PROGRESS_LABELS: Record<FollowUpProgress, string> = {
  BETTER: 'Getting better',
  SAME: 'About the same',
  WORSE: 'Getting worse',
};

/** What to do after each answer. Shown on the web and in the mobile app. */
export const FOLLOW_UP_ADVICE: Record<FollowUpProgress, string> = {
  BETTER:
    'Good news. Keep the area clean and dry, stop your pet licking it, and check again in a few days.',
  SAME:
    'Keep watching it closely. If it is not clearly better within 2 to 3 days, or you notice ' +
    'swelling, a smell or discharge, please see a vet.',
  WORSE:
    'A wound that is getting worse needs a vet. Please contact a veterinarian today, or an ' +
    'emergency clinic if your pet is in pain, bleeding, or seems unwell.',
};

export const followUpCreateSchema = z.object({
  inDays: z.coerce
    .number()
    .int()
    .refine((n) => (FOLLOW_UP_DAYS as readonly number[]).includes(n), {
      message: 'Please choose 1, 2, 3 or 7 days',
    }),
});
export type FollowUpCreate = z.infer<typeof followUpCreateSchema>;

export const followUpUpdateSchema = z.object({
  progress: z.enum(FOLLOW_UP_PROGRESS, { error: 'Please say how the wound looks now' }),
  note: optionalText(500),
});
export type FollowUpUpdate = z.infer<typeof followUpUpdateSchema>;

export interface WoundFollowUp {
  id: string;
  assessmentId: string;
  pet: { id: string; name: string };
  /** When the owner wanted to look again. */
  dueAt: string;
  /** Null until the owner records how the wound looks. */
  progress: FollowUpProgress | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
}
