import { HandHeart, Inbox, Megaphone, Siren } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { useMyListings } from '../adoption/useAdoption';
import { RescueRow } from '../rescue/RescueBits';
import { useRescueReports } from '../rescue/useRescue';

/** Rescuer dashboard: urgent reports, active rescues and adoption work in one place. */
export function RescuerOverview() {
  const open = useRescueReports('open');
  const listings = useMyListings();

  const waiting = open.data?.filter((report) => report.status === 'OPEN') ?? [];
  const urgent = waiting.filter(
    (report) => report.urgency === 'CRITICAL' || report.urgency === 'HIGH',
  );
  const mine = open.data?.filter((report) => report.assignedTo?.isMe) ?? [];
  const applications = listings.data?.reduce((sum, listing) => sum + listing.openApplications, 0);

  const stats = [
    {
      label: 'Urgent reports waiting',
      value: open.data ? urgent.length : undefined,
      icon: Siren,
      to: '/dashboard/rescue',
      highlight: urgent.length > 0,
    },
    {
      label: 'Rescues you are handling',
      value: open.data ? mine.length : undefined,
      icon: HandHeart,
      to: '/dashboard/rescue?view=mine',
      highlight: false,
    },
    {
      label: 'Adoption applications to review',
      value: applications,
      icon: Inbox,
      to: '/dashboard/listings',
      highlight: (applications ?? 0) > 0,
    },
  ];

  return (
    <>
      {open.isError && <Alert tone="error">{open.error.message}</Alert>}
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
      <section className="card today-card" aria-labelledby="waiting-heading">
        <div className="card-heading-row">
          <h2 id="waiting-heading" className="card-title">
            <Megaphone size={20} aria-hidden="true" /> Animals waiting for help
          </h2>
          <Link to="/dashboard/rescue" className="card-link">
            Rescue board
          </Link>
        </div>
        {open.isPending && <p className="muted">Loading reports…</p>}
        {open.isSuccess && waiting.length === 0 && (
          <div className="empty-state">
            <p>No animals are waiting for a rescuer right now.</p>
          </div>
        )}
        {waiting.length > 0 && (
          <ul className="plain-list">
            {waiting.slice(0, 5).map((report) => (
              <li key={report.id}>
                <RescueRow report={report} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
