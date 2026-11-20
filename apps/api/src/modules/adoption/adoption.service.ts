import type {
  AdoptionApplicationData,
  AdoptionListingData,
  ApplicationDecisionData,
} from '@vetnexa/shared';
import type { AdoptionListing, Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { deleteUpload, saveImage } from '../../lib/uploads';
import type { AuthUser } from '../../types/express';

export function toListingResponse(
  listing: AdoptionListing & { rescuer?: { firstName: string; lastName: string } },
) {
  return {
    id: listing.id,
    name: listing.name,
    species: listing.species,
    breed: listing.breed,
    sex: listing.sex,
    ageGroup: listing.ageGroup,
    approxAgeMonths: listing.approxAgeMonths,
    size: listing.size,
    city: listing.city,
    description: listing.description,
    healthSummary: listing.healthSummary,
    isVaccinated: listing.isVaccinated,
    isNeutered: listing.isNeutered,
    goodWithChildren: listing.goodWithChildren,
    goodWithPets: listing.goodWithPets,
    photoUrl: listing.photoUrl,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    rescuer: listing.rescuer
      ? `${listing.rescuer.firstName} ${listing.rescuer.lastName.charAt(0)}.`
      : null,
  };
}

function toColumns(data: AdoptionListingData) {
  return {
    name: data.name,
    species: data.species,
    breed: data.breed ?? null,
    sex: data.sex,
    ageGroup: data.ageGroup,
    size: data.size ?? null,
    city: data.city,
    description: data.description,
    healthSummary: data.healthSummary ?? null,
    isVaccinated: data.isVaccinated,
    isNeutered: data.isNeutered,
    goodWithChildren: data.goodWithChildren,
    goodWithPets: data.goodWithPets,
  };
}

const OPEN_APPLICATION: Prisma.AdoptionApplicationWhereInput['status'] = {
  in: ['SUBMITTED', 'UNDER_REVIEW'],
};

export interface ListingFilters {
  species?: string;
  ageGroup?: string;
  city?: string;
  goodWithChildren?: boolean;
}

export function adoptionService(prisma: PrismaClient) {
  /** A listing the rescuer manages; other rescuers' listings are "not found". */
  async function findOwnListing(rescuer: AuthUser, id: string) {
    const listing = await prisma.adoptionListing.findFirst({
      where: { id, ...(rescuer.role === 'ADMIN' ? {} : { rescuerId: rescuer.id }) },
    });
    if (!listing) throw HttpError.notFound('Listing not found');
    return listing;
  }

  const service = {
    /** Public browsing: available animals first, then those with an adoption pending. */
    async browse(filters: ListingFilters) {
      const where: Prisma.AdoptionListingWhereInput = { status: { in: ['AVAILABLE', 'PENDING'] } };
      if (filters.species) where.species = filters.species as AdoptionListing['species'];
      if (filters.ageGroup) where.ageGroup = filters.ageGroup as AdoptionListing['ageGroup'];
      if (filters.city) where.city = filters.city;
      if (filters.goodWithChildren) where.goodWithChildren = true;
      const [listings, cities] = await Promise.all([
        prisma.adoptionListing.findMany({
          where,
          include: { rescuer: { select: { firstName: true, lastName: true } } },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
        prisma.adoptionListing.findMany({
          where: { status: { in: ['AVAILABLE', 'PENDING'] } },
          distinct: ['city'],
          select: { city: true },
          orderBy: { city: 'asc' },
        }),
      ]);
      return { listings: listings.map(toListingResponse), cities: cities.map((c) => c.city) };
    },

    /** Public detail. Adopted or withdrawn animals are hidden except from their rescuer. */
    async detail(id: string, viewer?: AuthUser) {
      const listing = await prisma.adoptionListing.findUnique({
        where: { id },
        include: { rescuer: { select: { firstName: true, lastName: true } } },
      });
      const isRescuer =
        listing && viewer && (listing.rescuerId === viewer.id || viewer.role === 'ADMIN');
      if (!listing || (!['AVAILABLE', 'PENDING'].includes(listing.status) && !isRescuer)) {
        throw HttpError.notFound('This animal is no longer listed for adoption');
      }
      const myApplication = viewer
        ? await prisma.adoptionApplication.findUnique({
            where: { listingId_applicantId: { listingId: id, applicantId: viewer.id } },
            select: { id: true, status: true, createdAt: true },
          })
        : null;
      return {
        ...toListingResponse(listing),
        isMine: Boolean(isRescuer),
        myApplication,
        canApply:
          viewer?.role === 'OWNER' &&
          ['AVAILABLE', 'PENDING'].includes(listing.status) &&
          (!myApplication || myApplication.status === 'WITHDRAWN'),
      };
    },

    async mine(rescuer: AuthUser) {
      const listings = await prisma.adoptionListing.findMany({
        where: { rescuerId: rescuer.id },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          _count: { select: { applications: { where: { status: OPEN_APPLICATION } } } },
        },
      });
      return listings.map(({ _count, ...listing }) => ({
        ...toListingResponse(listing),
        openApplications: _count.applications,
      }));
    },

    async create(rescuer: AuthUser, data: AdoptionListingData) {
      const listing = await prisma.adoptionListing.create({
        data: { ...toColumns(data), rescuerId: rescuer.id },
      });
      return toListingResponse(listing);
    },

    async update(rescuer: AuthUser, id: string, data: AdoptionListingData) {
      await findOwnListing(rescuer, id);
      return toListingResponse(
        await prisma.adoptionListing.update({ where: { id }, data: toColumns(data) }),
      );
    },

    /** Withdraw a listing, or make a withdrawn one available again. */
    async setStatus(rescuer: AuthUser, id: string, status: 'AVAILABLE' | 'WITHDRAWN') {
      const listing = await findOwnListing(rescuer, id);
      if (listing.status === 'ADOPTED')
        throw HttpError.conflict('This animal has already been adopted.');
      return toListingResponse(
        await prisma.adoptionListing.update({ where: { id }, data: { status } }),
      );
    },

    async setPhoto(rescuer: AuthUser, id: string, image: Buffer) {
      const listing = await findOwnListing(rescuer, id);
      const photoUrl = await saveImage(image, { folder: 'adoption', size: 1000 });
      const updated = await prisma.adoptionListing.update({ where: { id }, data: { photoUrl } });
      await deleteUpload(listing.photoUrl);
      return toListingResponse(updated);
    },

    // ── Applications ──

    async apply(owner: AuthUser, listingId: string, data: AdoptionApplicationData) {
      const listing = await prisma.adoptionListing.findUnique({ where: { id: listingId } });
      if (!listing || !['AVAILABLE', 'PENDING'].includes(listing.status)) {
        throw HttpError.notFound('This animal is no longer listed for adoption');
      }
      const existing = await prisma.adoptionApplication.findUnique({
        where: { listingId_applicantId: { listingId, applicantId: owner.id } },
      });
      if (existing && existing.status !== 'WITHDRAWN') {
        throw HttpError.conflict('You have already applied to adopt this animal.');
      }
      const fields = { ...data, status: 'SUBMITTED' as const, rescuerNotes: null };
      const application = await prisma.adoptionApplication.upsert({
        where: { listingId_applicantId: { listingId, applicantId: owner.id } },
        create: { ...fields, listingId, applicantId: owner.id },
        update: fields, // re-applying after withdrawing
      });
      return { id: application.id, status: application.status };
    },

    async myApplications(owner: AuthUser) {
      const applications = await prisma.adoptionApplication.findMany({
        where: { applicantId: owner.id },
        orderBy: { createdAt: 'desc' },
        include: { listing: true },
      });
      return applications.map((application) => ({
        id: application.id,
        status: application.status,
        message: application.message,
        rescuerNotes: application.rescuerNotes,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        listing: toListingResponse(application.listing),
      }));
    },

    async withdraw(owner: AuthUser, applicationId: string) {
      const { count } = await prisma.adoptionApplication.updateMany({
        where: { id: applicationId, applicantId: owner.id, status: OPEN_APPLICATION },
        data: { status: 'WITHDRAWN' },
      });
      if (count === 0) throw HttpError.notFound('No open application to withdraw');
    },

    /** Applications for one of the rescuer's listings, with the applicants' contact details. */
    async applicationsFor(rescuer: AuthUser, listingId: string) {
      const listing = await findOwnListing(rescuer, listingId);
      const applications = await prisma.adoptionApplication.findMany({
        where: { listingId },
        orderBy: { createdAt: 'asc' },
        include: {
          applicant: { select: { firstName: true, lastName: true, email: true, city: true } },
        },
      });
      return {
        listing: toListingResponse(listing),
        applications: applications.map((application) => ({
          id: application.id,
          status: application.status,
          homeType: application.homeType,
          hasOtherPets: application.hasOtherPets,
          hasChildren: application.hasChildren,
          contactPhone: application.contactPhone,
          message: application.message,
          rescuerNotes: application.rescuerNotes,
          createdAt: application.createdAt.toISOString(),
          applicant: {
            name: `${application.applicant.firstName} ${application.applicant.lastName}`,
            email: application.applicant.email,
            city: application.applicant.city,
          },
        })),
      };
    },

    /**
     * The rescuer's decision.
     * - UNDER_REVIEW marks the listing "adoption pending" so other adopters know.
     * - APPROVED marks the animal as adopted and, in the same transaction, closes every other
     *   open application with a polite note, so nobody is left waiting.
     */
    async decide(rescuer: AuthUser, applicationId: string, decision: ApplicationDecisionData) {
      const application = await prisma.adoptionApplication.findUnique({
        where: { id: applicationId },
        include: { listing: true },
      });
      if (
        !application ||
        (application.listing.rescuerId !== rescuer.id && rescuer.role !== 'ADMIN')
      ) {
        throw HttpError.notFound('Application not found');
      }
      if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)) {
        throw HttpError.conflict(
          `This application is already ${application.status.toLowerCase().replace('_', ' ')}.`,
        );
      }
      if (application.listing.status === 'ADOPTED') {
        throw HttpError.conflict('This animal has already been adopted.');
      }

      await prisma.$transaction(async (tx) => {
        await tx.adoptionApplication.update({
          where: { id: applicationId },
          data: {
            status: decision.status,
            rescuerNotes: decision.rescuerNotes ?? application.rescuerNotes,
          },
        });
        if (decision.status === 'UNDER_REVIEW') {
          await tx.adoptionListing.update({
            where: { id: application.listingId },
            data: { status: 'PENDING' },
          });
        }
        if (decision.status === 'APPROVED') {
          await tx.adoptionListing.update({
            where: { id: application.listingId },
            data: { status: 'ADOPTED' },
          });
          await tx.adoptionApplication.updateMany({
            where: {
              listingId: application.listingId,
              id: { not: applicationId },
              status: OPEN_APPLICATION,
            },
            data: {
              status: 'REJECTED',
              rescuerNotes: `${application.listing.name} has found a home with another family. Thank you for applying.`,
            },
          });
        }
        // If the last open application is rejected, the animal becomes available again.
        if (decision.status === 'REJECTED' && application.listing.status === 'PENDING') {
          const stillOpen = await tx.adoptionApplication.count({
            where: { listingId: application.listingId, status: 'UNDER_REVIEW' },
          });
          if (stillOpen === 0) {
            await tx.adoptionListing.update({
              where: { id: application.listingId },
              data: { status: 'AVAILABLE' },
            });
          }
        }
      });
      return service.applicationsFor(rescuer, application.listingId);
    },
  };
  return service;
}
