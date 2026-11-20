import {
  RESCUE_STATUS_LABELS,
  RESCUE_URGENCY_LABELS,
  type RescueStatus,
  type RescueUrgency,
} from '@vetnexa/shared';
import { ChevronRight, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { PetAvatar } from '../pets/PetAvatar';
import type { RescueReport } from './useRescue';
import './rescue.css';

const urgencyTone: Record<RescueUrgency, string> = {
  CRITICAL: 'badge--danger',
  HIGH: 'badge--danger',
  MEDIUM: 'badge--warning',
  LOW: 'badge--neutral',
};
const statusTone: Record<RescueStatus, string> = {
  OPEN: 'badge--warning',
  IN_PROGRESS: 'badge--info',
  RESCUED: '',
  CLOSED: 'badge--neutral',
};

export function UrgencyBadge({ urgency }: { urgency: RescueUrgency }) {
  return (
    <span className={`badge ${urgencyTone[urgency]}`}>
      {RESCUE_URGENCY_LABELS[urgency].split(' –')[0]}
    </span>
  );
}

export function RescueStatusBadge({ status }: { status: RescueStatus }) {
  return <span className={`badge ${statusTone[status]}`}>{RESCUE_STATUS_LABELS[status]}</span>;
}

/** "2 hours ago", "3 days ago". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function RescueRow({ report }: { report: RescueReport }) {
  return (
    <Link
      to={`/dashboard/rescue/${report.id}`}
      className={`consultation-row rescue-row rescue-row--${report.urgency.toLowerCase()}`}
    >
      <PetAvatar
        name={report.title}
        species={report.species}
        photoUrl={report.photoUrl}
        size={48}
      />
      <span className="consultation-row__main">
        <strong>{report.title}</strong>
        <span className="consultation-row__meta">
          <span>
            <MapPin size={14} aria-hidden="true" /> {report.city}
          </span>
          <span>
            <Clock size={14} aria-hidden="true" /> {timeAgo(report.createdAt)}
          </span>
          {report.assignedTo && (
            <span>Rescuer: {report.assignedTo.isMe ? 'you' : report.assignedTo.name}</span>
          )}
        </span>
      </span>
      <span className="rescue-row__badges">
        <UrgencyBadge urgency={report.urgency} />
        <RescueStatusBadge status={report.status} />
      </span>
      <ChevronRight size={18} className="consultation-row__chevron" aria-hidden="true" />
    </Link>
  );
}
