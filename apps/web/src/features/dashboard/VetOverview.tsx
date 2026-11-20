import { CalendarCheck, CalendarDays, ClipboardCheck, Inbox } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ConsultationRow } from '../consultations/ConsultationBits';
import { useVetSummary } from '../consultations/useConsultations';

/** Verified vet's dashboard: key numbers and today's appointments. */
export function VetOverview() {
  const summary = useVetSummary();

  if (summary.isError) return <Alert tone="error">{summary.error.message}</Alert>;

  const stats = [
    {
      label: 'New requests',
      value: summary.data?.pendingRequests,
      icon: Inbox,
      to: '/dashboard/consultations?view=requests',
      highlight: (summary.data?.pendingRequests ?? 0) > 0,
    },
    {
      label: 'Appointments in the next 7 days',
      value: summary.data?.upcomingWeek,
      icon: CalendarDays,
      to: '/dashboard/consultations?view=upcoming',
    },
    {
      label: 'Completed this month',
      value: summary.data?.completedThisMonth,
      icon: ClipboardCheck,
      to: '/dashboard/consultations?view=past',
    },
  ];

  return (
    <>
      <ul className="stat-grid">
        {stats.map(({ label, value, icon: Icon, to, highlight }) => (
          <li key={label}>
            <Link to={to} className={`card stat-tile ${highlight ? 'stat-tile--highlight' : ''}`}>
              <Icon size={22} aria-hidden="true" />
              <strong>{value ?? '–'}</strong>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="card today-card" aria-labelledby="today-heading">
        <h2 id="today-heading" className="card-title">
          <CalendarCheck size={20} aria-hidden="true" /> Today’s appointments
        </h2>
        {summary.isPending && <p className="muted">Loading today’s schedule…</p>}
        {summary.isSuccess && summary.data.today.length === 0 && (
          <div className="empty-state">
            <p>No appointments today.</p>
          </div>
        )}
        {summary.isSuccess && summary.data.today.length > 0 && (
          <ul className="plain-list">
            {summary.data.today.map((consultation) => (
              <li key={consultation.id}>
                <ConsultationRow consultation={consultation} perspective="VET" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
