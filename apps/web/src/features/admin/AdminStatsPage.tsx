import { ROLE_LABELS, SEVERITY_LABELS, SPECIES_LABELS, type UserRole } from '@vetnexa/shared';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { AdminHeader } from './AdminBits';
import { useAdminStats } from './useAdmin';
import './admin.css';

const number = new Intl.NumberFormat('en-GB');
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function Tile({
  label,
  value,
  note,
  to,
}: {
  label: string;
  value: number;
  note?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="stat-tile__label">{label}</span>
      <strong className="stat-tile__value">{number.format(value)}</strong>
      {note && <span className="stat-tile__note">{note}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="card stat-tile stat-tile--link">
      {content}
    </Link>
  ) : (
    <div className="card stat-tile">{content}</div>
  );
}

/**
 * Horizontal bars for one measure split by category. One series, one hue: the number is
 * printed beside every bar, so the chart doubles as its own table and never relies on colour.
 */
function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card chart-card" aria-labelledby={`chart-${title}`}>
      <h2 id={`chart-${title}`} className="chart-card__title">
        {title}
      </h2>
      <dl className="bar-list">
        {rows.map((row) => (
          <div key={row.label} className="bar-list__row" title={`${row.label}: ${row.value}`}>
            <dt>{row.label}</dt>
            <dd>
              <span className="bar-list__track" aria-hidden="true">
                <span
                  className="bar-list__bar"
                  style={{ width: row.value ? `${Math.max(2, (row.value / max) * 100)}%` : 0 }}
                />
              </span>
              <span className="bar-list__value">{number.format(row.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Vertical bars for sign-ups per week: change over a short, regular time span. */
function WeeklyColumns({ weeks }: { weeks: { weekStart: string; count: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  return (
    <section className="card chart-card chart-card--wide" aria-labelledby="chart-signups">
      <h2 id="chart-signups" className="chart-card__title">
        New accounts per week (last 8 weeks)
      </h2>
      <div
        className="columns"
        role="img"
        aria-label="Weekly sign-ups chart; values in the table below"
      >
        {weeks.map((week) => (
          <div
            key={week.weekStart}
            className="columns__col"
            title={`Week of ${shortDate.format(new Date(week.weekStart))}: ${week.count}`}
          >
            <span className="columns__value">{week.count}</span>
            <span className="columns__bar" style={{ height: `${(week.count / max) * 100}%` }} />
            <span className="columns__label">{shortDate.format(new Date(week.weekStart))}</span>
          </div>
        ))}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Week starting</th>
              <th scope="col">New accounts</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.weekStart}>
                <td>{shortDate.format(new Date(week.weekStart))}</td>
                <td>{week.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function AdminStatsPage() {
  const stats = useAdminStats();

  return (
    <>
      <AdminHeader
        title="Administration"
        intro="How VetNexa is being used, and what needs attention."
      />
      {stats.isPending && <PageLoader label="Loading statistics…" />}
      {stats.isError && <Alert tone="error">{stats.error.message}</Alert>}
      {stats.isSuccess && (
        <>
          <h2 className="admin-subtitle">Needs attention</h2>
          <div className="stat-grid">
            <Tile
              label="Vets awaiting verification"
              value={stats.data.vets.pending}
              to="/dashboard/admin/vets"
            />
            <Tile
              label="New contact messages"
              value={stats.data.moderation.newMessages}
              to="/dashboard/admin/messages"
            />
            <Tile
              label="Open rescue reports"
              value={stats.data.rescue.open}
              to="/dashboard/rescue"
            />
            <Tile
              label="Suspended accounts"
              value={stats.data.users.suspended}
              to="/dashboard/admin/users?status=SUSPENDED"
            />
          </div>

          <h2 className="admin-subtitle">Platform</h2>
          <div className="stat-grid">
            <Tile
              label="Users"
              value={stats.data.users.total}
              note={`${stats.data.users.newLast30Days} new in the last 30 days`}
            />
            <Tile label="Pets registered" value={stats.data.pets.total} />
            <Tile
              label="Active clinics"
              value={stats.data.clinics.active}
              note={`${stats.data.clinics.emergency} with emergency care`}
            />
            <Tile label="Consultations" value={stats.data.consultations.total} />
            <Tile
              label="Wound checks"
              value={stats.data.assessments.total}
              note={`${stats.data.assessments.referredToVet} referred to a vet`}
            />
            <Tile
              label="Assistant questions"
              value={stats.data.assistant.questions}
              note={`${stats.data.assistant.emergencies} flagged as emergencies`}
            />
            <Tile
              label="Animals rescued"
              value={stats.data.rescue.rescued}
              note={`${stats.data.rescue.total} reports in total`}
            />
            <Tile
              label="Adoptions completed"
              value={stats.data.adoption.adopted}
              note={`${stats.data.adoption.available} animals available`}
            />
          </div>

          <div className="chart-grid">
            <WeeklyColumns weeks={stats.data.users.signupsByWeek} />
            <BarList
              title="Users by role"
              rows={Object.entries(stats.data.users.byRole).map(([role, value]) => ({
                label: ROLE_LABELS[role as UserRole],
                value,
              }))}
            />
            <BarList
              title="Pets by species"
              rows={Object.entries(stats.data.pets.bySpecies).map(([species, value]) => ({
                label: SPECIES_LABELS[species as keyof typeof SPECIES_LABELS],
                value,
              }))}
            />
            <BarList
              title="Wound checks by severity"
              rows={Object.entries(stats.data.assessments.bySeverity).map(([severity, value]) => ({
                label: SEVERITY_LABELS[severity as keyof typeof SEVERITY_LABELS],
                value,
              }))}
            />
            <BarList
              title="Consultations by status"
              rows={Object.entries(stats.data.consultations.byStatus).map(([status, value]) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase(),
                value,
              }))}
            />
          </div>
          <p className="field__hint">
            Figures are counts only and contain no personal data. Updated{' '}
            {new Date(stats.data.generatedAt).toLocaleTimeString('en-GB')}.
          </p>
        </>
      )}
    </>
  );
}
