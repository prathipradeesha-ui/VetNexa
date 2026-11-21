import { api } from '../../lib/api';
import { toQueryString, type ClinicFilters, type ClinicSummary } from '../clinics/useClinics';

/**
 * A copy of the public emergency clinic list kept on the phone, so names, phone numbers and
 * directions still work without internet (phone calls do not need a data connection). Only
 * public clinic details are saved; "open now" is left out because it goes out of date.
 */
export type SavedClinic = Pick<
  ClinicSummary,
  | 'id'
  | 'slug'
  | 'name'
  | 'addressLine'
  | 'city'
  | 'latitude'
  | 'longitude'
  | 'phone'
  | 'isOpen24Hours'
>;

export interface SavedClinicList {
  savedAt: string;
  clinics: SavedClinic[];
}

export const SAVED_CLINICS_KEY = 'vetnexa-emergency-clinics';
export const EMERGENCY_FILTERS: ClinicFilters = { emergency: true, sort: 'rating' };
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

export function saveClinics(clinics: ClinicSummary[], now = new Date()): void {
  const list: SavedClinicList = {
    savedAt: now.toISOString(),
    clinics: clinics.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      addressLine: c.addressLine,
      city: c.city,
      latitude: c.latitude,
      longitude: c.longitude,
      phone: c.phone,
      isOpen24Hours: c.isOpen24Hours,
    })),
  };
  try {
    localStorage.setItem(SAVED_CLINICS_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the live list still works online.
  }
}

export function loadSavedClinics(): SavedClinicList | null {
  try {
    const raw = localStorage.getItem(SAVED_CLINICS_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as SavedClinicList;
    return Array.isArray(list.clinics) && typeof list.savedAt === 'string' ? list : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the saved list fresh in the background, at most twice a day, so it is ready before an
 * emergency happens even if the person never opened the emergency page.
 */
export async function refreshSavedClinics(now = new Date()): Promise<void> {
  const saved = loadSavedClinics();
  if (saved && now.getTime() - new Date(saved.savedAt).getTime() < REFRESH_AFTER_MS) return;
  if (!navigator.onLine) return;
  try {
    const result = await api<{ clinics: ClinicSummary[] }>(
      `/clinics${toQueryString(EMERGENCY_FILTERS)}`,
    );
    saveClinics(result.clinics, now);
  } catch {
    // Try again next time the app opens.
  }
}
