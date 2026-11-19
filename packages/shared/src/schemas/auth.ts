import { z } from 'zod';
import { SELF_REGISTER_ROLES } from '../enums';

/**
 * Validation rules for authentication.
 * The same schema validates the registration form in the browser and the request body on the API,
 * so a user always sees the same error message in both places.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(191, 'Email is too long')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt only uses the first 72 bytes
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/** Accepts local Sri Lankan numbers (07XXXXXXXX) and international format (+947XXXXXXXX). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)7\d{8}$/, 'Enter a valid mobile number, for example 0771234567');

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().min(1, 'Last name is required').max(60),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(SELF_REGISTER_ROLES).default('OWNER'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
