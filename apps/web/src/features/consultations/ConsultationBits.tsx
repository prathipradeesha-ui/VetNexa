import {
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_TYPE_LABELS,
  formatAppointment,
  type ConsultationStatus,
} from '@vetnexa/shared';
import { CalendarClock, ChevronRight, MapPin, Video } from 'lucide-react';
import { Link } from 'react-router';
import { PetAvatar } from '../pets/PetAvatar';
import type { Consultation } from './useConsultations';

const statusTone: Record<ConsultationStatus, string> = {
  REQUESTED: 'badge--warning',
  CONFIRMED: '',
  COMPLETED: 'badge--info',
  CANCELLED: 'badge--neutral',
};

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <span className={`badge ${statusTone[status]}`}>{CONSULTATION_STATUS_LABELS[status]}</span>
  );
}

/**
 * One consultation in a list. Owners see the vet and clinic; vets see the patient's owner.
 */
export function ConsultationRow({
  consultation,
  perspective,
}: {
  consultation: Consultation;
  perspective: 'OWNER' | 'VET';
}) {
  const { pet } = consultation;
  const who =
    perspective === 'VET'
      ? `Owner: ${consultation.owner?.name ?? 'Unknown'}`
      : [consultation.vet?.name, consultation.clinic?.name].filter(Boolean).join(' · ');

  return (
    <Link to={`/dashboard/consultations/${consultation.id}`} className="consultation-row">
      <PetAvatar name={pet.name} species={pet.species} photoUrl={pet.photoUrl} size={48} />
      <span className="consultation-row__main">
        <strong>
          {pet.name}
          <span className="consultation-row__reason"> — {consultation.reason}</span>
        </strong>
        <span className="consultation-row__meta">
          <span>
            <CalendarClock size={14} aria-hidden="true" />{' '}
            {formatAppointment(consultation.scheduledAt)}
          </span>
          <span>
            {consultation.type === 'VIDEO' ? (
              <Video size={14} aria-hidden="true" />
            ) : (
              <MapPin size={14} aria-hidden="true" />
            )}{' '}
            {CONSULTATION_TYPE_LABELS[consultation.type]}
          </span>
          {who && <span>{who}</span>}
        </span>
      </span>
      <StatusBadge status={consultation.status} />
      <ChevronRight size={18} className="consultation-row__chevron" aria-hidden="true" />
    </Link>
  );
}
