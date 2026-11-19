import { BellRing, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { dueLabel, formatDate } from '../pets/format';
import { RecordTypeIcon } from '../records/RecordTypeIcon';
import { useReminders } from '../records/useRecords';

/**
 * Owner dashboard card: overdue care first (in red), then anything due in the next 60 days.
 * Each item links to the pet's profile, where a new record can be added.
 */
export function CareRemindersCard() {
  const reminders = useReminders();
  const overdue = reminders.data?.filter((r) => r.status === 'OVERDUE').length ?? 0;

  return (
    <section className="card reminders-card" aria-labelledby="reminders-heading">
      <div className="card-heading-row">
        <h2 id="reminders-heading" className="card-title">
          <BellRing size={20} aria-hidden="true" /> Upcoming care
        </h2>
        {overdue > 0 && <span className="badge badge--danger">{overdue} overdue</span>}
      </div>

      {reminders.isPending && <p className="muted">Checking upcoming care…</p>}
      {reminders.isError && <Alert tone="error">{reminders.error.message}</Alert>}

      {reminders.isSuccess && reminders.data.length === 0 && (
        <div className="empty-state">
          <CheckCircle2 size={28} aria-hidden="true" />
          <p>Nothing is due in the next 60 days.</p>
        </div>
      )}

      {reminders.isSuccess && reminders.data.length > 0 && (
        <ul className="reminder-list">
          {reminders.data.map((reminder) => (
            <li key={reminder.recordId}>
              <Link to={`/dashboard/pets/${reminder.pet.id}`} className="reminder">
                <RecordTypeIcon type={reminder.type} size={16} />
                <span className="reminder__text">
                  <strong>
                    {reminder.pet.name}: {reminder.title}
                  </strong>
                  <span>{formatDate(reminder.dueDate)}</span>
                </span>
                <span
                  className={
                    reminder.status === 'OVERDUE' ? 'badge badge--danger' : 'badge badge--warning'
                  }
                >
                  {dueLabel(reminder.dueDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
