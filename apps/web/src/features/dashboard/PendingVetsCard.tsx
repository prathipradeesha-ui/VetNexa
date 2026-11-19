import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2 } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';

interface PendingVet {
  licenseNumber: string;
  specialization: string | null;
  yearsExperience: number | null;
  clinic: { id: string; name: string; city: string } | null;
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
}

const PENDING_VETS_KEY = ['admin', 'vets', 'pending'] as const;

/** Admin-only card: veterinarians waiting for licence verification, with an approve action. */
export function PendingVetsCard() {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: PENDING_VETS_KEY,
    queryFn: () => api<{ vets: PendingVet[] }>('/admin/vets/pending').then((res) => res.vets),
  });

  const approve = useMutation({
    mutationFn: (userId: string) =>
      api(`/admin/vets/${userId}/verification`, { method: 'PATCH', body: { approved: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_VETS_KEY }),
  });

  return (
    <section className="card pending-vets" aria-labelledby="pending-vets-heading">
      <h2 id="pending-vets-heading" className="card-title">
        <BadgeCheck size={20} aria-hidden="true" /> Veterinarians awaiting verification
      </h2>

      {pending.isPending && <p className="muted">Loading verification requests…</p>}
      {pending.isError && <Alert tone="error">{pending.error.message}</Alert>}
      {approve.isError && <Alert tone="error">{approve.error.message}</Alert>}

      {pending.isSuccess && pending.data.length === 0 && (
        <div className="empty-state">
          <CheckCircle2 size={28} aria-hidden="true" />
          <p>All caught up. No veterinarians are waiting for verification.</p>
        </div>
      )}

      {pending.isSuccess && pending.data.length > 0 && (
        <ul className="pending-list">
          {pending.data.map((vet) => (
            <li key={vet.user.id} className="pending-list__item">
              <div>
                <strong>
                  Dr. {vet.user.firstName} {vet.user.lastName}
                </strong>
                <span>
                  Licence {vet.licenseNumber}
                  {vet.specialization && ` · ${vet.specialization}`}
                </span>
                <span>
                  {vet.clinic ? `${vet.clinic.name}, ${vet.clinic.city}` : 'No clinic linked'} ·{' '}
                  {vet.user.email}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => approve.mutate(vet.user.id)}
                loading={approve.isPending && approve.variables === vet.user.id}
                disabled={approve.isPending}
              >
                Approve
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
