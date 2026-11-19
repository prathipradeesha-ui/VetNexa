import type { User, VetProfile } from '../../generated/prisma/client';

/**
 * The only shape in which user data leaves the API.
 * Listing the fields explicitly guarantees the password hash can never be sent by accident,
 * even if new columns are added to the User table later.
 */
export function toPublicUser(user: User & { vetProfile?: VetProfile | null }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    phone: user.phone,
    role: user.role,
    status: user.status,
    city: user.city,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    vetProfile: user.vetProfile
      ? {
          licenseNumber: user.vetProfile.licenseNumber,
          specialization: user.vetProfile.specialization,
          yearsExperience: user.vetProfile.yearsExperience,
          clinicId: user.vetProfile.clinicId,
          isVerified: user.vetProfile.isVerified,
        }
      : null,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
