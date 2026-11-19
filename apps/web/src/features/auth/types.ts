import type { UserRole } from '@vetnexa/shared';

/** The user object returned by the API (matches toPublicUser on the server). */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
  city: string | null;
  avatarUrl: string | null;
  createdAt: string;
  vetProfile: {
    licenseNumber: string;
    specialization: string | null;
    yearsExperience: number | null;
    clinicId: string | null;
    isVerified: boolean;
  } | null;
}
