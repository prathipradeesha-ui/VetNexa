import type { HealthRecordType, PetData, PetSex, Species } from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from '../../lib/api';

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: PetSex;
  dateOfBirth: string | null;
  weightKg: number | null;
  color: string | null;
  microchipId: string | null;
  isNeutered: boolean;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PetSummary extends Pet {
  recordCount: number;
  nextDue: { title: string; type: HealthRecordType; date: string } | null;
}

export const petKeys = {
  all: ['pets'] as const,
  detail: (id: string) => ['pets', id] as const,
};

export function usePets() {
  return useQuery({
    queryKey: petKeys.all,
    queryFn: () => api<{ pets: PetSummary[] }>('/pets').then((res) => res.pets),
  });
}

export function usePet(id: string) {
  return useQuery({
    queryKey: petKeys.detail(id),
    queryFn: () => api<{ pet: Pet }>(`/pets/${id}`).then((res) => res.pet),
  });
}

/** Creates a pet when no id is given, otherwise updates it. */
export function useSavePet(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PetData) =>
      api<{ pet: Pet }>(id ? `/pets/${id}` : '/pets', {
        method: id ? 'PUT' : 'POST',
        body: data,
      }).then((res) => res.pet),
    onSuccess: (pet) => {
      queryClient.setQueryData(petKeys.detail(pet.id), pet);
      void queryClient.invalidateQueries({ queryKey: petKeys.all, exact: true });
    },
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/pets/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: petKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: petKeys.all, exact: true });
    },
  });
}

export function usePetPhoto(id: string) {
  const queryClient = useQueryClient();
  const onSuccess = (pet: Pet) => {
    queryClient.setQueryData(petKeys.detail(id), pet);
    void queryClient.invalidateQueries({ queryKey: petKeys.all, exact: true });
  };
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiUpload<{ pet: Pet }>(`/pets/${id}/photo`, 'photo', file).then((res) => res.pet),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: () =>
      api<{ pet: Pet }>(`/pets/${id}/photo`, { method: 'DELETE' }).then((res) => res.pet),
    onSuccess,
  });
  return { upload, remove };
}
