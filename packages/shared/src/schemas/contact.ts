import { z } from 'zod';
import { emailSchema, phoneSchema } from './auth';

export const CONTACT_TOPICS = [
  'GENERAL',
  'ACCOUNT_SUPPORT',
  'VET_PARTNERSHIP',
  'CLINIC_LISTING',
  'RESCUE_ADOPTION',
  'FEEDBACK',
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  GENERAL: 'General question',
  ACCOUNT_SUPPORT: 'Help with my account',
  VET_PARTNERSHIP: 'Joining as a veterinarian',
  CLINIC_LISTING: 'Listing a clinic',
  RESCUE_ADOPTION: 'Rescue or adoption',
  FEEDBACK: 'Feedback or suggestion',
};

/** Contact form, validated in the browser and again by the API. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  topic: z.enum(CONTACT_TOPICS, { error: 'Please choose a topic' }),
  message: z
    .string()
    .trim()
    .min(20, 'Please write at least 20 characters so we can help')
    .max(2000, 'Please keep your message under 2000 characters'),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;
