import { formatPetAge, PET_SEX_LABELS, SPECIES_LABELS } from '@vetnexa/shared';
import type { Pet } from './usePets';

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "12 Mar 2024" from "2024-03-12" (dates are stored without a time). */
export function formatDate(isoDate: string) {
  return dayFormat.format(new Date(`${isoDate}T00:00:00`));
}

/** Whole days from today until the given date (negative when it has passed). */
export function daysUntil(isoDate: string, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function dueLabel(isoDate: string) {
  const days = daysUntil(isoDate);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

/** One-line description, e.g. "Labrador Retriever · Male · 4 yrs 3 mos · 31.4 kg". */
export function petSummaryLine(pet: Pet) {
  return [
    pet.breed ?? SPECIES_LABELS[pet.species],
    pet.sex !== 'UNKNOWN' ? PET_SEX_LABELS[pet.sex] : null,
    formatPetAge(pet.dateOfBirth),
    pet.weightKg !== null ? `${pet.weightKg} kg` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
