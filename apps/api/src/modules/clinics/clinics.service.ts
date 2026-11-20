import {
  isClinicOpen,
  type ClinicSearch,
  type OpeningHours,
  type ReviewData,
} from '@vetnexa/shared';
import type { Clinic, Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';

const asStringArray = (value: Prisma.JsonValue) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const asHours = (value: Prisma.JsonValue) =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as OpeningHours;

/** Fields shown on directory cards. `isOpenNow` is worked out at request time. */
export function toClinicSummary(clinic: Clinic, now = new Date()) {
  const openingHours = asHours(clinic.openingHours);
  return {
    id: clinic.id,
    slug: clinic.slug,
    name: clinic.name,
    addressLine: clinic.addressLine,
    city: clinic.city,
    district: clinic.district,
    phone: clinic.phone,
    services: asStringArray(clinic.services),
    hasEmergency: clinic.hasEmergency,
    isOpen24Hours: clinic.isOpen24Hours,
    isOpenNow: isClinicOpen(openingHours, clinic.isOpen24Hours, now),
    averageRating: Number(clinic.averageRating),
    reviewCount: clinic.reviewCount,
    imageUrl: clinic.imageUrl,
  };
}

/** Reviewers are shown as "Nimali P." so their full name is not published. */
const reviewerName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName.charAt(0)}.`;

/** Roles allowed to review clinics. Vets and admins are excluded to avoid conflicts of interest. */
const REVIEWER_ROLES = new Set(['OWNER', 'RESCUER']);

export function clinicsService(prisma: PrismaClient) {
  async function findActiveClinic(slug: string) {
    const clinic = await prisma.clinic.findFirst({ where: { slug, isActive: true } });
    if (!clinic) throw HttpError.notFound('Clinic not found');
    return clinic;
  }

  /** Recalculates the cached average and count after reviews change. */
  async function refreshRating(tx: Prisma.TransactionClient, clinicId: string) {
    const stats = await tx.review.aggregate({
      where: { clinicId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    await tx.clinic.update({
      where: { id: clinicId },
      data: {
        averageRating: Math.round((stats._avg.rating ?? 0) * 100) / 100,
        reviewCount: stats._count,
      },
    });
  }

  return {
    /**
     * Directory search. Text, city and emergency filters run in the database; the service and
     * "open now" filters are applied afterwards because they depend on JSON columns and the
     * current time. That is fine for a national directory of a few hundred clinics.
     */
    async search(filters: ClinicSearch, now = new Date()) {
      const where: Prisma.ClinicWhereInput = { isActive: true };
      if (filters.city) where.city = filters.city;
      if (filters.emergency) where.OR = [{ hasEmergency: true }, { isOpen24Hours: true }];
      if (filters.q) {
        where.AND = [
          {
            OR: [
              { name: { contains: filters.q } },
              { city: { contains: filters.q } },
              { district: { contains: filters.q } },
              { addressLine: { contains: filters.q } },
            ],
          },
        ];
      }

      const clinics = await prisma.clinic.findMany({
        where,
        orderBy:
          filters.sort === 'name'
            ? [{ name: 'asc' }]
            : [{ averageRating: 'desc' }, { reviewCount: 'desc' }, { name: 'asc' }],
      });

      const service = filters.service?.toLowerCase();
      const results = clinics
        .map((clinic) => toClinicSummary(clinic, now))
        .filter((clinic) => !service || clinic.services.some((s) => s.toLowerCase() === service))
        .filter((clinic) => !filters.openNow || clinic.isOpenNow);

      // Options for the filter drop-downs, taken from all active clinics.
      const all = await prisma.clinic.findMany({
        where: { isActive: true },
        select: { city: true, services: true },
      });
      const facets = {
        cities: [...new Set(all.map((c) => c.city))].sort(),
        services: [...new Set(all.flatMap((c) => asStringArray(c.services)))].sort(),
      };

      return { clinics: results, total: results.length, facets };
    },

    async detail(slug: string, viewerId?: string, now = new Date()) {
      const clinic = await findActiveClinic(slug);
      const [vets, reviews, distribution, myReview] = await Promise.all([
        prisma.vetProfile.findMany({
          where: { clinicId: clinic.id, isVerified: true },
          select: {
            specialization: true,
            yearsExperience: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.review.findMany({
          where: { clinicId: clinic.id, status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            createdAt: true,
            authorId: true,
            author: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.review.groupBy({
          by: ['rating'],
          where: { clinicId: clinic.id, status: 'APPROVED' },
          _count: true,
        }),
        viewerId
          ? prisma.review.findUnique({
              where: { clinicId_authorId: { clinicId: clinic.id, authorId: viewerId } },
              select: { id: true, rating: true, title: true, comment: true, status: true },
            })
          : null,
      ]);

      return {
        ...toClinicSummary(clinic, now),
        description: clinic.description,
        email: clinic.email,
        website: clinic.website,
        latitude: clinic.latitude === null ? null : Number(clinic.latitude),
        longitude: clinic.longitude === null ? null : Number(clinic.longitude),
        openingHours: asHours(clinic.openingHours),
        vets: vets.map((vet) => ({
          id: vet.user.id,
          name: `Dr. ${vet.user.firstName} ${vet.user.lastName}`,
          specialization: vet.specialization,
          yearsExperience: vet.yearsExperience,
        })),
        ratingDistribution: [5, 4, 3, 2, 1].map((stars) => ({
          stars,
          count: distribution.find((row) => row.rating === stars)?._count ?? 0,
        })),
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          createdAt: review.createdAt,
          author: reviewerName(review.author),
          isMine: review.authorId === viewerId,
        })),
        myReview,
      };
    },

    /** Creates the viewer's review or replaces their earlier one, then refreshes the rating. */
    async saveReview(user: { id: string; role: string }, slug: string, data: ReviewData) {
      if (!REVIEWER_ROLES.has(user.role)) {
        throw HttpError.forbidden(
          'Reviews are written by pet owners and rescuers, so veterinarians and administrators cannot review clinics.',
        );
      }
      const clinic = await findActiveClinic(slug);
      return prisma.$transaction(async (tx) => {
        const fields = { rating: data.rating, title: data.title ?? null, comment: data.comment };
        const review = await tx.review.upsert({
          where: { clinicId_authorId: { clinicId: clinic.id, authorId: user.id } },
          create: { ...fields, clinicId: clinic.id, authorId: user.id },
          update: { ...fields, status: 'APPROVED' },
          select: { id: true, rating: true, title: true, comment: true, status: true },
        });
        await refreshRating(tx, clinic.id);
        return review;
      });
    },

    async deleteMyReview(userId: string, slug: string) {
      const clinic = await findActiveClinic(slug);
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.review.deleteMany({
          where: { clinicId: clinic.id, authorId: userId },
        });
        if (count === 0) throw HttpError.notFound('You have not reviewed this clinic');
        await refreshRating(tx, clinic.id);
      });
    },
  };
}
