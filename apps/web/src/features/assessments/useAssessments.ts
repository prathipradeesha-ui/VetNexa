import type { AssessmentServiceStatus, WoundAssessmentResult } from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiForm, ApiError } from '../../lib/api';

export const assessmentKeys = {
  all: ['assessments'] as const,
  status: ['assessments', 'status'] as const,
  detail: (id: string) => ['assessments', id] as const,
};

export function useAssessmentStatus() {
  return useQuery({
    queryKey: assessmentKeys.status,
    queryFn: () => api<AssessmentServiceStatus>('/assessments/status'),
    staleTime: 30_000,
  });
}

export function useAssessments() {
  return useQuery({
    queryKey: assessmentKeys.all,
    queryFn: () =>
      api<{ assessments: WoundAssessmentResult[] }>('/assessments').then((r) => r.assessments),
  });
}

export function useAssessment(id: string) {
  return useQuery({
    queryKey: assessmentKeys.detail(id),
    queryFn: () =>
      api<{ assessment: WoundAssessmentResult }>(`/assessments/${id}`).then((r) => r.assessment),
  });
}

export interface NewAssessment {
  petId: string;
  photo: File;
  ownerNotes?: string;
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ petId, photo, ownerNotes }: NewAssessment) => {
      const form = new FormData();
      form.append('petId', petId);
      if (ownerNotes) form.append('ownerNotes', ownerNotes);
      form.append('photo', photo);
      return apiForm<{ assessment: WoundAssessmentResult }>('/assessments', form).then(
        (r) => r.assessment,
      );
    },
    onSuccess: (assessment) => {
      queryClient.setQueryData(assessmentKeys.detail(assessment.id), assessment);
      void queryClient.invalidateQueries({ queryKey: assessmentKeys.all, exact: true });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/assessments/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: assessmentKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: assessmentKeys.all, exact: true });
    },
  });
}

/** Advice from the photo-quality check, when the API rejected a photo. */
export function photoQualityProblems(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || error.code !== 'PHOTO_QUALITY') return null;
  const problems = (error.data as { problems?: unknown } | undefined)?.problems;
  return Array.isArray(problems) ? problems.map(String) : [];
}
