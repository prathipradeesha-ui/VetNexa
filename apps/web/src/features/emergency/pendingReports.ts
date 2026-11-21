import type { GuestRescueReportData } from '@vetnexa/shared';
import { ApiError } from '../../lib/api';

/**
 * Rescue reports written without a connection. They wait on the reporter's own phone and are
 * sent as soon as VetNexa can be reached again, then removed from the phone.
 */
export interface PendingReport {
  id: string;
  savedAt: string;
  data: GuestRescueReportData;
}

export interface SentReport {
  title: string;
  reference: string;
}

export const PENDING_REPORTS_KEY = 'vetnexa-pending-rescue-reports';
const MAX_PENDING = 5;

/** True when the report could not be sent for a reason that should pass (no connection, busy). */
export function shouldRetry(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}

export function listPending(): PendingReport[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_REPORTS_KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? (list as PendingReport[]) : [];
  } catch {
    return [];
  }
}

function store(list: PendingReport[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_REPORTS_KEY);
    else localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: nothing more we can do on this phone.
  }
}

/** Saves a report to send later. Returns false if it could not be kept on this phone. */
export function queueReport(data: GuestRescueReportData, now = new Date()): boolean {
  const list = listPending();
  if (list.length >= MAX_PENDING) return false;
  const report: PendingReport = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: now.toISOString(),
    data,
  };
  store([...list, report]);
  return listPending().some((item) => item.id === report.id);
}

let sending: Promise<SentReport[]> | null = null;

/**
 * Sends every waiting report, oldest first. Stops at the first one that cannot get through
 * yet, so nothing is lost; reports the server rejects for good are dropped.
 */
export function sendPendingReports(
  send: (data: GuestRescueReportData) => Promise<{ reference: string }>,
): Promise<SentReport[]> {
  // One run at a time, so a report is never sent twice.
  sending ??= (async () => {
    const sent: SentReport[] = [];
    for (const report of listPending()) {
      try {
        const { reference } = await send(report.data);
        sent.push({ title: report.data.title, reference });
      } catch (error) {
        if (shouldRetry(error)) break;
      }
      store(listPending().filter((item) => item.id !== report.id));
    }
    return sent;
  })().finally(() => {
    sending = null;
  });
  return sending;
}
