import type {
  AssessmentServiceStatus,
  GuestAssessmentResult,
  GuestRescueReportData,
} from '@vetnexa/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiForm } from '../../lib/api';

export function useEmergencyStatus() {
  return useQuery({
    queryKey: ['emergency', 'status'],
    queryFn: () => api<AssessmentServiceStatus>('/emergency/status'),
    staleTime: 30_000,
  });
}

export interface GuestCheck {
  species: 'DOG' | 'CAT';
  photo: File;
  answers?: object;
}

/** Wound check without an account. The result is returned once and never stored. */
export function useGuestAssessment() {
  return useMutation({
    mutationFn: ({ species, photo, answers }: GuestCheck) => {
      const form = new FormData();
      form.append('species', species);
      if (answers) form.append('answers', JSON.stringify(answers));
      form.append('photo', photo);
      return apiForm<{ assessment: GuestAssessmentResult }>('/emergency/assess', form).then(
        (r) => r.assessment,
      );
    },
  });
}

export function useGuestRescueReport() {
  return useMutation({
    mutationFn: (data: GuestRescueReportData) =>
      api<{ report: { reference: string; createdAt: string } }>('/emergency/rescue', {
        method: 'POST',
        body: data,
      }).then((r) => r.report),
  });
}
