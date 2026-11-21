import type { AdminUserQuery, ClinicFormData, ContactStatus } from '@vetnexa/shared';
import type { Clinic, Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { refreshClinicRating } from '../clinics/clinics.service';

export const PAGE_SIZE = 20;

const page = (n: number) => ({ skip: (n - 1) * PAGE_SIZE, take: PAGE_SIZE });
const pageInfo = (n: number, total: number) => ({
  page: n,
  pageSize: PAGE_SIZE,
  total,
  pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
});

/** "Harbourview Animal Hospital", "Colombo" → "harbourview-animal-hospital-colombo" */
export function slugify(...parts: string[]) {
  return parts
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function toAdminClinic(clinic: Clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    description: clinic.description,
    addressLine: clinic.addressLine,
    city: clinic.city,
    district: clinic.district,
    latitude: clinic.latitude === null ? null : Number(clinic.latitude),
    longitude: clinic.longitude === null ? null : Number(clinic.longitude),
    phone: clinic.phone,
    email: clinic.email,
    website: clinic.website,
    services: clinic.services as string[],
    openingHours: clinic.openingHours as Record<string, string>,
    hasEmergency: clinic.hasEmergency,
    isOpen24Hours: clinic.isOpen24Hours,
    isActive: clinic.isActive,
    averageRating: Number(clinic.averageRating),
    reviewCount: clinic.reviewCount,
    createdAt: clinic.createdAt,
    updatedAt: clinic.updatedAt,
  };
}

function clinicColumns(data: ClinicFormData) {
  return {
    name: data.name,
    description: data.description ?? null,
    addressLine: data.addressLine,
    city: data.city,
    district: data.district,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    phone: data.phone,
    email: data.email ?? null,
    website: data.website ?? null,
    services: data.services,
    openingHours: data.openingHours,
    hasEmergency: data.hasEmergency,
    isOpen24Hours: data.isOpen24Hours,
  };
}

export function adminService(prisma: PrismaClient) {
  return {
    // ── Users ──

    async listUsers(query: AdminUserQuery) {
      const where: Prisma.UserWhereInput = {
        ...(query.role && { role: query.role }),
        ...(query.status && { status: query.status }),
        ...(query.q && {
          OR: [
            { firstName: { contains: query.q } },
            { lastName: { contains: query.q } },
            { email: { contains: query.q } },
          ],
        }),
      };
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page(query.page),
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            status: true,
            city: true,
            createdAt: true,
            lastLoginAt: true,
            vetProfile: { select: { licenseNumber: true, isVerified: true } },
            _count: { select: { pets: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);
      return {
        users: users.map(({ _count, ...user }) => ({ ...user, petCount: _count.pets })),
        ...pageInfo(query.page, total),
      };
    },

    /**
     * Suspends or reactivates an account. A suspended user is signed out on their next request
     * (the session check re-loads the user every time). Admins cannot suspend themselves or
     * other administrators, so the platform can never be locked out by mistake.
     */
    async setUserStatus(adminId: string, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
      if (adminId === userId) throw HttpError.forbidden('You cannot change your own account');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw HttpError.notFound('User not found');
      if (user.role === 'ADMIN') {
        throw HttpError.forbidden('Administrator accounts cannot be suspended here');
      }
      return prisma.user.update({
        where: { id: userId },
        data: { status },
        select: { id: true, status: true },
      });
    },

    // ── Clinics ──

    async listClinics(q?: string) {
      const clinics = await prisma.clinic.findMany({
        where: q ? { OR: [{ name: { contains: q } }, { city: { contains: q } }] } : {},
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
      return clinics.map(toAdminClinic);
    },

    async getClinic(id: string) {
      const clinic = await prisma.clinic.findUnique({ where: { id } });
      if (!clinic) throw HttpError.notFound('Clinic not found');
      return toAdminClinic(clinic);
    },

    async createClinic(data: ClinicFormData) {
      // Slugs are public URLs (/clinics/<slug>), so they are unique and never change later.
      const base = slugify(data.name, data.city) || 'clinic';
      let slug = base;
      for (let n = 2; await prisma.clinic.findUnique({ where: { slug } }); n += 1) {
        slug = `${base}-${n}`;
      }
      const clinic = await prisma.clinic.create({ data: { ...clinicColumns(data), slug } });
      return toAdminClinic(clinic);
    },

    async updateClinic(id: string, data: ClinicFormData) {
      await this.getClinic(id);
      const clinic = await prisma.clinic.update({ where: { id }, data: clinicColumns(data) });
      return toAdminClinic(clinic);
    },

    /** Hidden clinics disappear from the public directory but keep their history. */
    async setClinicActive(id: string, isActive: boolean) {
      await this.getClinic(id);
      const clinic = await prisma.clinic.update({ where: { id }, data: { isActive } });
      return toAdminClinic(clinic);
    },

    // ── Reviews ──

    async listReviews(status: string | undefined, pageNumber: number) {
      const where: Prisma.ReviewWhereInput =
        status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING' ? { status } : {};
      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page(pageNumber),
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            status: true,
            createdAt: true,
            clinic: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        prisma.review.count({ where }),
      ]);
      return { reviews, ...pageInfo(pageNumber, total) };
    },

    /** Hiding or showing a review also updates the clinic's average rating. */
    async moderateReview(id: string, status: 'APPROVED' | 'REJECTED') {
      return prisma.$transaction(async (tx) => {
        const review = await tx.review.findUnique({ where: { id } });
        if (!review) throw HttpError.notFound('Review not found');
        const updated = await tx.review.update({
          where: { id },
          data: { status },
          select: { id: true, status: true, clinicId: true },
        });
        await refreshClinicRating(tx, review.clinicId);
        return updated;
      });
    },

    // ── Contact messages ──

    async listMessages(status: string | undefined, pageNumber: number) {
      const where: Prisma.ContactMessageWhereInput =
        status === 'NEW' || status === 'IN_PROGRESS' || status === 'RESOLVED' ? { status } : {};
      const [messages, total] = await Promise.all([
        prisma.contactMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...page(pageNumber),
        }),
        prisma.contactMessage.count({ where }),
      ]);
      return { messages, ...pageInfo(pageNumber, total) };
    },

    async setMessageStatus(id: string, status: ContactStatus) {
      const message = await prisma.contactMessage.findUnique({ where: { id } });
      if (!message) throw HttpError.notFound('Message not found');
      return prisma.contactMessage.update({
        where: { id },
        data: { status },
        select: { id: true, status: true },
      });
    },
  };
}
