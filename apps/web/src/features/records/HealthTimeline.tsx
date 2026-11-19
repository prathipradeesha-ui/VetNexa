import { HEALTH_RECORD_LABELS, HEALTH_RECORD_TYPES, type HealthRecordType } from '@vetnexa/shared';
import {
  CalendarClock,
  ClipboardPlus,
  Lock,
  MapPin,
  Pencil,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { dueLabel, daysUntil, formatDate } from '../pets/format';
import { RecordTypeIcon } from './RecordTypeIcon';
import { useDeleteRecord, useRecords, type HealthRecord } from './useRecords';
import './records.css';

/** A pet's medical history as a timeline, newest first, with filters by record type. */
export function HealthTimeline({ petId, petName }: { petId: string; petName: string }) {
  const records = useRecords(petId);
  const [filter, setFilter] = useState<HealthRecordType | 'ALL'>('ALL');

  const counts = new Map<HealthRecordType, number>();
  for (const record of records.data ?? []) {
    counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
  }
  const visible = (records.data ?? []).filter((r) => filter === 'ALL' || r.type === filter);

  return (
    <section className="card timeline-card" aria-labelledby="records-heading">
      <div className="timeline-card__header">
        <h2 id="records-heading">Health records</h2>
        <Link to={`/dashboard/pets/${petId}/records/new`} className="btn btn--primary btn--sm">
          <ClipboardPlus size={16} aria-hidden="true" /> Add record
        </Link>
      </div>

      {records.isPending && <p className="muted">Loading health records…</p>}
      {records.isError && <Alert tone="error">{records.error.message}</Alert>}

      {records.isSuccess && records.data.length === 0 && (
        <div className="empty-state">
          <p>
            No health records yet. Add {petName}’s vaccinations, treatments and check-ups to build a
            complete history.
          </p>
        </div>
      )}

      {records.isSuccess && records.data.length > 0 && (
        <>
          <div className="filter-chips" role="group" aria-label="Filter records by type">
            <button
              type="button"
              className="chip"
              aria-pressed={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
            >
              All <span className="chip__count">{records.data.length}</span>
            </button>
            {HEALTH_RECORD_TYPES.filter((type) => counts.has(type)).map((type) => (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={filter === type}
                onClick={() => setFilter(type)}
              >
                {HEALTH_RECORD_LABELS[type]} <span className="chip__count">{counts.get(type)}</span>
              </button>
            ))}
          </div>

          <ol className="timeline">
            {visible.map((record) => (
              <TimelineItem key={record.id} record={record} petId={petId} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function TimelineItem({ record, petId }: { record: HealthRecord; petId: string }) {
  const remove = useDeleteRecord(petId);
  const [confirming, setConfirming] = useState(false);
  const overdue = record.nextDueDate !== null && daysUntil(record.nextDueDate) < 0;

  return (
    <li className="timeline__item">
      <RecordTypeIcon type={record.type} />
      <article className="timeline__body">
        <header className="timeline__header">
          <div>
            <span className="timeline__type">{HEALTH_RECORD_LABELS[record.type]}</span>
            <h3>{record.title}</h3>
          </div>
          <time dateTime={record.recordDate} className="timeline__date">
            {formatDate(record.recordDate)}
          </time>
        </header>

        {record.description && <p className="timeline__description">{record.description}</p>}

        <div className="timeline__meta">
          {record.vetName && (
            <span>
              <Stethoscope size={14} aria-hidden="true" /> {record.vetName}
            </span>
          )}
          {record.clinicName && (
            <span>
              <MapPin size={14} aria-hidden="true" /> {record.clinicName}
            </span>
          )}
          {record.nextDueDate && (
            <span className={overdue ? 'badge badge--danger' : 'badge badge--warning'}>
              <CalendarClock size={12} aria-hidden="true" /> Next: {formatDate(record.nextDueDate)}{' '}
              ({dueLabel(record.nextDueDate).toLowerCase()})
            </span>
          )}
        </div>

        <footer className="timeline__footer">
          <span className="timeline__author">
            {record.canEdit ? (
              'Added by you'
            ) : (
              <>
                <Lock size={12} aria-hidden="true" /> Added by{' '}
                {record.createdBy?.name ?? 'a clinic'}
              </>
            )}
          </span>
          {record.canEdit && !confirming && (
            <span className="timeline__actions">
              <Link
                to={`/dashboard/pets/${petId}/records/${record.id}/edit`}
                className="icon-link"
                aria-label={`Edit ${record.title}`}
              >
                <Pencil size={15} aria-hidden="true" /> Edit
              </Link>
              <button
                type="button"
                className="icon-link icon-link--danger"
                onClick={() => setConfirming(true)}
                aria-label={`Delete ${record.title}`}
              >
                <Trash2 size={15} aria-hidden="true" /> Delete
              </button>
            </span>
          )}
          {confirming && (
            <span className="timeline__confirm" role="group" aria-label="Confirm deletion">
              Delete this record?
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="btn--danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(record.id)}
              >
                Delete
              </Button>
            </span>
          )}
        </footer>
        {remove.isError && <Alert tone="error">{remove.error.message}</Alert>}
      </article>
    </li>
  );
}
