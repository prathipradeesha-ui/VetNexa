import type {
  ConsultationOutcomeData,
  ConsultationRequestData,
  ConsultationStatus,
  ConsultationType,
  Species,
} from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { HealthRecord } from '../records/useRecords';

export interface Consultation {
  id: string;
  status: ConsultationStatus;
  type: ConsultationType;
  scheduledAt: string;
  reason: string;
  diagnosis: string | null;
  treatment: string | null;
  vetNotes: string | null;
  followUpAt: string | null;
  pet: {
    id: string;
    name: string;
    species: Species;
    breed: string | null;
    photoUrl: string | null;
    dateOfBirth: string | null;
  };
  vet: { id: string; name: string } | null;
  clinic: { id: string; name: string; slug: string; phone: string; city: string } | null;
  /** Only sent to the vet. */
  owner: { name: string; phone: string | null; email: string } | null;
  actions: {
    canConfirm: boolean;
    canComplete: boolean;
    canCancel: boolean;
    canViewPatient: boolean;
  };
  createdAt: string;
}

export type ConsultationView = 'upcoming' | 'requests' | 'past' | 'all';

export interface BookableVet {
  id: string;
  name: string;
  specialization: string | null;
  yearsExperience: number | null;
  clinic: { id: string; name: string; city: string } | null;
}

export interface Patient {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: string;
  dateOfBirth: string | null;
  weightKg: number | null;
  microchipId: string | null;
  isNeutered: boolean;
  photoUrl: string | null;
  notes: string | null;
  owner: { name: string; phone: string | null };
  records: HealthRecord[];
}

export interface VetSummary {
  pendingRequests: number;
  upcomingWeek: number;
  completedThisMonth: number;
  today: Consultation[];
}

export const consultationKeys = {
  all: ['consultations'] as const,
  list: (view: ConsultationView) => ['consultations', 'list', view] as const,
  detail: (id: string) => ['consultations', id] as const,
  summary: ['consultations', 'vet-summary'] as const,
  patient: (petId: string) => ['consultations', 'patient', petId] as const,
};

export function useConsultations(view: ConsultationView) {
  return useQuery({
    queryKey: consultationKeys.list(view),
    queryFn: () =>
      api<{ consultations: Consultation[] }>(`/consultations?view=${view}`).then(
        (res) => res.consultations,
      ),
  });
}

export function useConsultation(id: string) {
  return useQuery({
    queryKey: consultationKeys.detail(id),
    queryFn: () =>
      api<{ consultation: Consultation }>(`/consultations/${id}`).then((res) => res.consultation),
  });
}

export function useVetSummary(enabled = true) {
  return useQuery({
    queryKey: consultationKeys.summary,
    queryFn: () => api<VetSummary>('/vet/summary'),
    enabled,
  });
}

export function usePatient(petId: string) {
  return useQuery({
    queryKey: consultationKeys.patient(petId),
    queryFn: () => api<{ patient: Patient }>(`/vet/patients/${petId}`).then((res) => res.patient),
  });
}

export function useBookableVets() {
  return useQuery({
    queryKey: ['vets'],
    queryFn: () => api<{ vets: BookableVet[] }>('/vets').then((res) => res.vets),
    staleTime: 5 * 60 * 1000,
  });
}

/** Any consultation change can affect lists, the dashboard and pets' records, so refresh them. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (consultation?: Consultation) => {
    if (consultation)
      queryClient.setQueryData(consultationKeys.detail(consultation.id), consultation);
    void queryClient.invalidateQueries({ queryKey: consultationKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['pets'] });
    void queryClient.invalidateQueries({ queryKey: ['reminders'] });
  };
}

export function useRequestConsultation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: ConsultationRequestData) =>
      api<{ consultation: Consultation }>('/consultations', { method: 'POST', body: data }).then(
        (res) => res.consultation,
      ),
    onSuccess: refresh,
  });
}

export function useConsultationActions(id: string) {
  const refresh = useRefresh();
  const setStatus = useMutation({
    mutationFn: (body: { status: 'CONFIRMED' | 'CANCELLED'; note?: string }) =>
      api<{ consultation: Consultation }>(`/consultations/${id}/status`, {
        method: 'PATCH',
        body,
      }).then((res) => res.consultation),
    onSuccess: refresh,
  });
  const complete = useMutation({
    mutationFn: (outcome: ConsultationOutcomeData) =>
      api<{ consultation: Consultation }>(`/consultations/${id}/complete`, {
        method: 'POST',
        body: outcome,
      }).then((res) => res.consultation),
    onSuccess: refresh,
  });
  return { setStatus, complete };
}
