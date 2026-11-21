import type { GuestRescueReportData, RescueReportData } from '@vetnexa/shared';
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

/** About 1.1 km: shown to rescuers who have not taken the report on yet. */
export const APPROXIMATE_DECIMALS = 2;
const roundTo = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Phone numbers are personal: responders see the reporter's contact details so they can find
 * the animal, and the reporter sees who is handling their report.
 */
export function toReportResponse(row: ReportRow, viewer: AuthUser) {
  const responder = isResponder(viewer);
  const isAssignee = row.assignedToId === viewer.id;
  const isReporter = row.reporterId !== null && row.reporterId === viewer.id;
  // "Location shared safely": the exact spot only for the reporter, the rescuer handling the
  // report and administrators. Other rescuers see the area (about 1 km) until they take it on.
  const exact = isReporter || isAssignee || viewer.role === 'ADMIN';
  const coordinate = (value: unknown) =>
    value === null ? null : exact ? Number(value) : roundTo(Number(value), APPROXIMATE_DECIMALS);
  return {
    id: row.id,
    species: row.species,
    title: row.title,
    description: row.description,
    locationText: row.locationText,
    city: row.city,
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    locationApproximate: !exact && row.latitude !== null,
    urgency: row.urgency,
    status: row.status,
    photoUrl: row.photoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reporter: {
      name: row.reporter
        ? `${row.reporter.firstName} ${row.reporter.lastName.charAt(0)}.`
        : `${row.reporterName ?? 'Guest'} (no account)`,
      phone: responder ? (row.contactPhone ?? row.reporter?.phone ?? null) : null,
      isMe: isReporter,
      isGuest: row.reporterId === null,
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
      canClose: row.status === 'OPEN' && (viewer.role === 'ADMIN' || isReporter),
      canChangePhoto: isReporter && ['OPEN', 'IN_PROGRESS'].includes(row.status),
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
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
        include,
      });
      return toReportResponse(row, viewer);
    },

    /**
     * Emergency report from someone without an account. Nothing about the report is shown back
     * except a reference number; rescuers contact the reporter by phone.
     */
    async createAsGuest(data: GuestRescueReportData) {
      const row = await prisma.rescueReport.create({
        data: {
          reporterName: data.reporterName,
          species: data.species,
          title: data.title,
          description: data.description,
          locationText: data.locationText,
          city: data.city,
          urgency: data.urgency,
          contactPhone: data.contactPhone,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
        select: { id: true, createdAt: true },
      });
      return { reference: row.id.slice(-8).toUpperCase(), createdAt: row.createdAt.toISOString() };
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
