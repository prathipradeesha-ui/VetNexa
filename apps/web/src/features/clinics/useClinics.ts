import type { OpeningHours, ReviewData } from '@vetnexa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface ClinicSummary {
  id: string;
  slug: string;
  name: string;
  addressLine: string;
  city: string;
  district: string;
  phone: string;
  services: string[];
  hasEmergency: boolean;
  isOpen24Hours: boolean;
  isOpenNow: boolean;
  averageRating: number;
  reviewCount: number;
  imageUrl: string | null;
}

export interface ClinicReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  createdAt: string;
  author: string;
  isMine: boolean;
}

export interface ClinicDetail extends ClinicSummary {
  description: string | null;
  email: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: OpeningHours;
  vets: {
    id: string;
    name: string;
    specialization: string | null;
    yearsExperience: number | null;
  }[];
  ratingDistribution: { stars: number; count: number }[];
  reviews: ClinicReview[];
  myReview: { id: string; rating: number; title: string | null; comment: string } | null;
}

export interface ClinicFilters {
  q?: string;
  city?: string;
  service?: string;
  emergency?: boolean;
  openNow?: boolean;
  sort?: 'rating' | 'name';
}

interface SearchResult {
  clinics: ClinicSummary[];
  total: number;
  facets: { cities: string[]; services: string[] };
}

/** Builds "?city=Kandy&emergency=true" from the filters, leaving out empty ones. */
export function toQueryString(filters: ClinicFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue;
    if (key === 'sort' && value === 'rating') continue; // the default
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const clinicKeys = {
  search: (filters: ClinicFilters) => ['clinics', 'search', filters] as const,
  detail: (slug: string) => ['clinics', slug] as const,
};

export function useClinicSearch(filters: ClinicFilters) {
  return useQuery({
    queryKey: clinicKeys.search(filters),
    queryFn: () => api<SearchResult>(`/clinics${toQueryString(filters)}`),
    placeholderData: keepPreviousData, // keep showing results while a new search loads
  });
}

export function useClinic(slug: string) {
  return useQuery({
    queryKey: clinicKeys.detail(slug),
    queryFn: () => api<{ clinic: ClinicDetail }>(`/clinics/${slug}`).then((res) => res.clinic),
  });
}

export function useSaveReview(slug: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clinics'] });
  const save = useMutation({
    mutationFn: (data: ReviewData) =>
      api(`/clinics/${slug}/reviews/mine`, { method: 'PUT', body: data }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/clinics/${slug}/reviews/mine`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  return { save, remove };
}
