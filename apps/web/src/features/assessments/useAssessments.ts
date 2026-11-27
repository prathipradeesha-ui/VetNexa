import type {
  AssessmentServiceStatus,
  FollowUpUpdate,
  WoundAssessmentResult,
  WoundFollowUp,
} from '@vetnexa/shared';
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
  /** Questionnaire answers (see symptomAnswersSchema in @vetnexa/shared). */
  answers?: object;
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ petId, photo, ownerNotes, answers }: NewAssessment) => {
      const form = new FormData();
      form.append('petId', petId);
      if (ownerNotes) form.append('ownerNotes', ownerNotes);
      if (answers) form.append('answers', JSON.stringify(answers));
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

export const followUpKeys = { all: ['assessments', 'follow-ups'] as const };

export function useFollowUps() {
  return useQuery({
    queryKey: followUpKeys.all,
    queryFn: () =>
      api<{ followUps: WoundFollowUp[] }>('/assessments/follow-ups').then((r) => r.followUps),
  });
}

/** After any follow-up change, the result page and the dashboard list are refreshed. */
function useRefreshFollowUps() {
  const queryClient = useQueryClient();
  return (assessmentId: string) => {
    void queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(assessmentId) });
    void queryClient.invalidateQueries({ queryKey: followUpKeys.all });
  };
}

export function useCreateFollowUp(assessmentId: string) {
  const refresh = useRefreshFollowUps();
  return useMutation({
    mutationFn: (inDays: number) =>
      api<{ followUp: WoundFollowUp }>(`/assessments/${assessmentId}/follow-ups`, {
        method: 'POST',
        body: { inDays },
      }).then((r) => r.followUp),
    onSuccess: () => refresh(assessmentId),
  });
}

export function useCompleteFollowUp(assessmentId: string) {
  const refresh = useRefreshFollowUps();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & FollowUpUpdate) =>
      api<{ followUp: WoundFollowUp }>(`/assessments/follow-ups/${id}`, {
        method: 'PATCH',
        body,
      }).then((r) => r.followUp),
    onSuccess: () => refresh(assessmentId),
  });
}

export function useCancelFollowUp(assessmentId: string) {
  const refresh = useRefreshFollowUps();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/assessments/follow-ups/${id}`, { method: 'DELETE' }),
    onSuccess: () => refresh(assessmentId),
  });
}
