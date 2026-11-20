import type {
  AdoptionApplicationData,
  AdoptionListingData,
  AdoptionStatus,
  AgeGroup,
  ApplicationDecisionData,
  ApplicationStatus,
  PetSex,
  Species,
} from '@vetnexa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from '../../lib/api';

export interface Listing {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: PetSex;
  ageGroup: AgeGroup;
  approxAgeMonths: number | null;
  size: string | null;
  city: string;
  description: string;
  healthSummary: string | null;
  isVaccinated: boolean;
  isNeutered: boolean;
  goodWithChildren: boolean | null;
  goodWithPets: boolean | null;
  photoUrl: string | null;
  status: AdoptionStatus;
  createdAt: string;
  rescuer: string | null;
}

export interface ListingDetail extends Listing {
  isMine: boolean;
  myApplication: { id: string; status: ApplicationStatus; createdAt: string } | null;
  canApply: boolean;
}

export interface MyListing extends Listing {
  openApplications: number;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  message: string;
  rescuerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  listing: Listing;
}

export interface ReceivedApplication {
  id: string;
  status: ApplicationStatus;
  homeType: string;
  hasOtherPets: boolean;
  hasChildren: boolean;
  contactPhone: string;
  message: string;
  rescuerNotes: string | null;
  createdAt: string;
  applicant: { name: string; email: string; city: string | null };
}

export interface ListingFilters {
  species?: string;
  ageGroup?: string;
  city?: string;
  goodWithChildren?: boolean;
}

const queryString = (filters: ListingFilters) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const adoptionKeys = {
  all: ['adoption'] as const,
  browse: (filters: ListingFilters) => ['adoption', 'browse', filters] as const,
  detail: (id: string) => ['adoption', 'listing', id] as const,
  mine: ['adoption', 'mine'] as const,
  applicationsFor: (id: string) => ['adoption', 'applications', id] as const,
  myApplications: ['adoption', 'my-applications'] as const,
};

export function useListings(filters: ListingFilters) {
  return useQuery({
    queryKey: adoptionKeys.browse(filters),
    queryFn: () =>
      api<{ listings: Listing[]; cities: string[] }>(`/adoption/listings${queryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: adoptionKeys.detail(id),
    queryFn: () =>
      api<{ listing: ListingDetail }>(`/adoption/listings/${id}`).then((res) => res.listing),
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: adoptionKeys.mine,
    queryFn: () =>
      api<{ listings: MyListing[] }>('/adoption/listings/mine').then((res) => res.listings),
  });
}

export function useApplicationsFor(listingId: string) {
  return useQuery({
    queryKey: adoptionKeys.applicationsFor(listingId),
    queryFn: () =>
      api<{ listing: Listing; applications: ReceivedApplication[] }>(
        `/adoption/listings/${listingId}/applications`,
      ),
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: adoptionKeys.myApplications,
    queryFn: () =>
      api<{ applications: MyApplication[] }>('/adoption/applications/mine').then(
        (res) => res.applications,
      ),
  });
}

/** Every adoption change can affect several lists, so refresh all adoption data. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adoptionKeys.all });
}

export function useSaveListing(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: AdoptionListingData) =>
      api<{ listing: Listing }>(id ? `/adoption/listings/${id}` : '/adoption/listings', {
        method: id ? 'PUT' : 'POST',
        body: data,
      }).then((res) => res.listing),
    onSuccess: refresh,
  });
}

export function useListingActions(id: string) {
  const refresh = useRefresh();
  const setStatus = useMutation({
    mutationFn: (status: 'AVAILABLE' | 'WITHDRAWN') =>
      api(`/adoption/listings/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: refresh,
  });
  const uploadPhoto = useMutation({
    mutationFn: (file: File) => apiUpload(`/adoption/listings/${id}/photo`, 'photo', file),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: ({
      applicationId,
      ...decision
    }: ApplicationDecisionData & { applicationId: string }) =>
      api(`/adoption/applications/${applicationId}/decision`, { method: 'PATCH', body: decision }),
    onSuccess: refresh,
  });
  return { setStatus, uploadPhoto, decide };
}

export function useApply(listingId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: AdoptionApplicationData) =>
      api(`/adoption/listings/${listingId}/applications`, { method: 'POST', body: data }),
    onSuccess: refresh,
  });
}

export function useWithdrawApplication() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (applicationId: string) =>
      api<void>(`/adoption/applications/${applicationId}/withdraw`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
