import type { RescueReportData, RescueStatus, RescueUrgency, Species } from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from '../../lib/api';

export interface RescueReport {
  id: string;
  species: Species;
  title: string;
  description: string;
  locationText: string;
  city: string;
  latitude: number | null;
  /** True when the position is rounded to about 1 km for privacy. */
  locationApproximate: boolean;
  longitude: number | null;
  urgency: RescueUrgency;
  status: RescueStatus;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: { name: string; phone: string | null; isMe: boolean; isGuest: boolean };
  assignedTo: { name: string; phone: string | null; isMe: boolean } | null;
  actions: { canTakeOn: boolean; canResolve: boolean; canClose: boolean; canChangePhoto: boolean };
}

export type RescueView = 'open' | 'mine' | 'resolved';

export const rescueKeys = {
  all: ['rescue'] as const,
  list: (view: RescueView) => ['rescue', 'list', view] as const,
  detail: (id: string) => ['rescue', id] as const,
};

export function useRescueReports(view: RescueView) {
  return useQuery({
    queryKey: rescueKeys.list(view),
    queryFn: () =>
      api<{ reports: RescueReport[] }>(`/rescue?view=${view}`).then((res) => res.reports),
  });
}

export function useRescueReport(id: string) {
  return useQuery({
    queryKey: rescueKeys.detail(id),
    queryFn: () => api<{ report: RescueReport }>(`/rescue/${id}`).then((res) => res.report),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return (report?: RescueReport) => {
    if (report) queryClient.setQueryData(rescueKeys.detail(report.id), report);
    void queryClient.invalidateQueries({ queryKey: rescueKeys.all });
  };
}

export function useCreateReport() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (data: RescueReportData) =>
      api<{ report: RescueReport }>('/rescue', { method: 'POST', body: data }).then(
        (r) => r.report,
      ),
    onSuccess: refresh,
  });
}

export function useRescueActions(id: string) {
  const refresh = useRefresh();
  const takeOn = useMutation({
    mutationFn: () =>
      api<{ report: RescueReport }>(`/rescue/${id}/take-on`, { method: 'POST' }).then(
        (r) => r.report,
      ),
    onSuccess: refresh,
  });
  const setStatus = useMutation({
    mutationFn: (status: 'RESCUED' | 'CLOSED') =>
      api<{ report: RescueReport }>(`/rescue/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }).then((r) => r.report),
    onSuccess: refresh,
  });
  const uploadPhoto = useMutation({
    mutationFn: (file: File) =>
      apiUpload<{ report: RescueReport }>(`/rescue/${id}/photo`, 'photo', file).then(
        (r) => r.report,
      ),
    onSuccess: refresh,
  });
  return { takeOn, setStatus, uploadPhoto };
}
