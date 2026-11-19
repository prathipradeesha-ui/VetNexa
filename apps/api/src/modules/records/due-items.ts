import type { HealthRecordType } from '../../generated/prisma/client';

interface DatedRecord {
  type: HealthRecordType;
  title: string;
  recordDate: Date;
  nextDueDate: Date | null;
  createdAt?: Date;
}

/**
 * Returns the records whose due dates still matter.
 *
 * Repeated care (e.g. a yearly rabies vaccine) appears several times in a pet's history.
 * Only the most recent entry for each type + title counts: once this year's vaccine is
 * recorded, last year's entry and its due date are no longer relevant.
 * Titles are compared ignoring case and surrounding spaces.
 *
 * Used by both the care reminders and the "next due" item on each pet card, so the two
 * always agree.
 */
export function currentDueItems<T extends DatedRecord>(records: T[], groupKey: (r: T) => string) {
  const newestFirst = [...records].sort(
    (a, b) =>
      b.recordDate.getTime() - a.recordDate.getTime() ||
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  );
  const seen = new Set<string>();
  const current: (T & { nextDueDate: Date })[] = [];
  for (const record of newestFirst) {
    const key = `${groupKey(record)}|${record.type}|${record.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (record.nextDueDate) current.push(record as T & { nextDueDate: Date });
  }
  return current.sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
}
