import type { HealthRecordData, HealthRecordType, Species, UserRole } from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { petKeys } from '../pets/usePets';

export interface HealthRecord {
  id: string;
  petId: string;
  type: HealthRecordType;
  title: string;
  description: string | null;
  recordDate: string;
  nextDueDate: string | null;
  vetName: string | null;
  clinicName: string | null;
  createdBy: { id: string; name: string; role: UserRole } | null;
  canEdit: boolean;
  createdAt: string;
}

export interface Reminder {
  recordId: string;
  type: HealthRecordType;
  title: string;
  dueDate: string;
  daysUntilDue: number;
  status: 'OVERDUE' | 'UPCOMING';
  pet: { id: string; name: string; species: Species; photoUrl: string | null };
}

export const recordKeys = {
  forPet: (petId: string) => ['pets', petId, 'records'] as const,
  reminders: ['reminders'] as const,
};

export function useRecords(petId: string) {
  return useQuery({
    queryKey: recordKeys.forPet(petId),
    queryFn: () =>
      api<{ records: HealthRecord[] }>(`/pets/${petId}/records`).then((res) => res.records),
  });
}

export function useReminders() {
  return useQuery({
    queryKey: recordKeys.reminders,
    queryFn: () => api<{ reminders: Reminder[] }>('/reminders').then((res) => res.reminders),
  });
}

/** After any change, refresh the pet's history, the pet cards and the reminders. */
function useRefreshAfterChange(petId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: recordKeys.forPet(petId) });
    void queryClient.invalidateQueries({ queryKey: petKeys.all, exact: true });
    void queryClient.invalidateQueries({ queryKey: recordKeys.reminders });
  };
}

export function useSaveRecord(petId: string, recordId?: string) {
  const refresh = useRefreshAfterChange(petId);
  return useMutation({
    mutationFn: (data: HealthRecordData) =>
      api<{ record: HealthRecord }>(
        recordId ? `/pets/${petId}/records/${recordId}` : `/pets/${petId}/records`,
        { method: recordId ? 'PUT' : 'POST', body: data },
      ).then((res) => res.record),
    onSuccess: refresh,
  });
}

export function useDeleteRecord(petId: string) {
  const refresh = useRefreshAfterChange(petId);
  return useMutation({
    mutationFn: (recordId: string) =>
      api<void>(`/pets/${petId}/records/${recordId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}
