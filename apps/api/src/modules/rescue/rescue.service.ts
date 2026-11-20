import type { RescueReportData } from '@vetnexa/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { HttpError } from '../../lib/http-error';
import { deleteUpload, saveImage } from '../../lib/uploads';
import type { AuthUser } from '../../types/express';

const include = {
  reporter: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, phone: true } },
} satisfies Prisma.RescueReportInclude;
type ReportRow = Prisma.RescueReportGetPayload<{ include: typeof include }>;

/** Rescuers and administrators work the rescue board; everyone else sees their own reports. */
const isResponder = (user: AuthUser) => user.role === 'RESCUER' || user.role === 'ADMIN';
const URGENCY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/**
 * Phone numbers are personal: responders see the reporter's contact details so they can find
 * the animal, and the reporter sees who is handling their report.
 */
export function toReportResponse(row: ReportRow, viewer: AuthUser) {
  const responder = isResponder(viewer);
  const isAssignee = row.assignedToId === viewer.id;
  return {
    id: row.id,
    species: row.species,
    title: row.title,
    description: row.description,
    locationText: row.locationText,
    city: row.city,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    urgency: row.urgency,
    status: row.status,
    photoUrl: row.photoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reporter: {
      name: `${row.reporter.firstName} ${row.reporter.lastName.charAt(0)}.`,
      phone: responder ? (row.contactPhone ?? row.reporter.phone) : null,
      isMe: row.reporterId === viewer.id,
    },
    assignedTo: row.assignedTo
      ? {
          name: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`,
          phone: row.reporterId === viewer.id || responder ? row.assignedTo.phone : null,
          isMe: isAssignee,
        }
      : null,
    actions: {
      canTakeOn: viewer.role === 'RESCUER' && row.status === 'OPEN',
      canResolve: row.status === 'IN_PROGRESS' && (isAssignee || viewer.role === 'ADMIN'),
      canClose: row.status === 'OPEN' && (viewer.role === 'ADMIN' || row.reporterId === viewer.id),
      canChangePhoto: row.reporterId === viewer.id && ['OPEN', 'IN_PROGRESS'].includes(row.status),
    },
  };
}

export type RescueView = 'open' | 'mine' | 'resolved';

export function rescueService(prisma: PrismaClient) {
  async function findVisible(viewer: AuthUser, id: string) {
    const row = await prisma.rescueReport.findUnique({ where: { id }, include });
    const visible =
      row &&
      (isResponder(viewer) || row.reporterId === viewer.id || row.assignedToId === viewer.id);
    if (!visible) throw HttpError.notFound('Rescue report not found');
    return row;
  }

  return {
    /**
     * Responders: "open" (waiting or in progress), "mine" (assigned to me), "resolved".
     * Other users always get the reports they made.
     */
    async list(viewer: AuthUser, view: RescueView, city?: string) {
      const where: Prisma.RescueReportWhereInput = {};
      if (!isResponder(viewer)) where.reporterId = viewer.id;
      else if (view === 'mine') where.assignedToId = viewer.id;
      else if (view === 'resolved') where.status = { in: ['RESCUED', 'CLOSED'] };
      else where.status = { in: ['OPEN', 'IN_PROGRESS'] };
      if (city) where.city = city;

      const rows = await prisma.rescueReport.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      // Most urgent first; waiting reports before ones already being handled.
      rows.sort(
        (a, b) =>
          Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN') ||
          URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
      return rows.map((row) => toReportResponse(row, viewer));
    },

    async get(viewer: AuthUser, id: string) {
      return toReportResponse(await findVisible(viewer, id), viewer);
    },

    async create(viewer: AuthUser, data: RescueReportData) {
      const row = await prisma.rescueReport.create({
        data: {
          reporterId: viewer.id,
          species: data.species,
          title: data.title,
          description: data.description,
          locationText: data.locationText,
          city: data.city,
          urgency: data.urgency,
          contactPhone: data.contactPhone ?? null,
        },
        include,
      });
      return toReportResponse(row, viewer);
    },

    /** A rescuer takes on an open report. The update only succeeds if nobody else got there first. */
    async takeOn(viewer: AuthUser, id: string) {
      await findVisible(viewer, id);
      const { count } = await prisma.rescueReport.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'IN_PROGRESS', assignedToId: viewer.id },
      });
      if (count === 0)
        throw HttpError.conflict('Another rescuer has already taken on this report.');
      return toReportResponse(await findVisible(viewer, id), viewer);
    },

    async setStatus(viewer: AuthUser, id: string, status: 'RESCUED' | 'CLOSED') {
      const row = await findVisible(viewer, id);
      const { actions } = toReportResponse(row, viewer);
      const allowed =
        status === 'RESCUED' ? actions.canResolve : actions.canClose || actions.canResolve;
      if (!allowed) throw HttpError.forbidden('You cannot change the status of this report.');
      const updated = await prisma.rescueReport.update({
        where: { id },
        data: { status },
        include,
      });
      return toReportResponse(updated, viewer);
    },

    async setPhoto(viewer: AuthUser, id: string, image: Buffer) {
      const row = await findVisible(viewer, id);
      if (!toReportResponse(row, viewer).actions.canChangePhoto) {
        throw HttpError.forbidden('Only the person who reported the animal can add a photo.');
      }
      const photoUrl = await saveImage(image, { folder: 'rescue', size: 1000 });
      const updated = await prisma.rescueReport.update({
        where: { id },
        data: { photoUrl },
        include,
      });
      await deleteUpload(row.photoUrl);
      return toReportResponse(updated, viewer);
    },
  };
}
