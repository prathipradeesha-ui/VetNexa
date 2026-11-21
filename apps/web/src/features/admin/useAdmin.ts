import type {
  AccountStatus,
  AdminStats,
  ClinicFormData,
  ContactStatus,
  ContactTopic,
  ModerationStatus,
  UserRole,
} from '@vetnexa/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface Paged {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  vetProfile: { licenseNumber: string; isVerified: boolean } | null;
  petCount: number;
}

export interface AdminClinic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  addressLine: string;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string | null;
  website: string | null;
  services: string[];
  openingHours: Record<string, string>;
  hasEmergency: boolean;
  isOpen24Hours: boolean;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
}

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: ModerationStatus;
  createdAt: string;
  clinic: { id: string; name: string; slug: string };
  author: { id: string; firstName: string; lastName: string; email: string };
}

export interface AdminMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  topic: ContactTopic;
  message: string;
  status: ContactStatus;
  userId: string | null;
  createdAt: string;
}

export const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  users: (params: string) => ['admin', 'users', params] as const,
  clinics: (q: string) => ['admin', 'clinics', q] as const,
  clinic: (id: string) => ['admin', 'clinic', id] as const,
  reviews: (params: string) => ['admin', 'reviews', params] as const,
  messages: (params: string) => ['admin', 'messages', params] as const,
};

/** Builds a query string, leaving out empty values. */
export const toQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.all });
}

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => api<{ stats: AdminStats }>('/admin/stats').then((r) => r.stats),
  });
}

export function useAdminUsers(params: {
  q?: string;
  role?: string;
  status?: string;
  page: number;
}) {
  const query = toQuery(params);
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => api<Paged & { users: AdminUser[] }>(`/admin/users${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useAdminClinics(q: string) {
  const query = toQuery({ q });
  return useQuery({
    queryKey: adminKeys.clinics(query),
    queryFn: () => api<{ clinics: AdminClinic[] }>(`/admin/clinics${query}`).then((r) => r.clinics),
    placeholderData: keepPreviousData,
  });
}

export function useAdminClinic(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.clinic(id ?? ''),
    queryFn: () => api<{ clinic: AdminClinic }>(`/admin/clinics/${id}`).then((r) => r.clinic),
    enabled: Boolean(id),
  });
}

export function useSaveClinic(id?: string) {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: (data: ClinicFormData) =>
      api<{ clinic: AdminClinic }>(id ? `/admin/clinics/${id}` : '/admin/clinics', {
        method: id ? 'PUT' : 'POST',
        body: data,
      }).then((r) => r.clinic),
    onSuccess: invalidate,
  });
}

export function useSetClinicActive() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/admin/clinics/${id}/active`, { method: 'PATCH', body: { isActive } }),
    onSuccess: invalidate,
  });
}

export function useAdminReviews(params: { status?: string; page: number }) {
  const query = toQuery(params);
  return useQuery({
    queryKey: adminKeys.reviews(query),
    queryFn: () => api<Paged & { reviews: AdminReview[] }>(`/admin/reviews${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useModerateReview() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useAdminMessages(params: { status?: string; page: number }) {
  const query = toQuery(params);
  return useQuery({
    queryKey: adminKeys.messages(query),
    queryFn: () => api<Paged & { messages: AdminMessage[] }>(`/admin/messages${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useSetMessageStatus() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactStatus }) =>
      api(`/admin/messages/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}
