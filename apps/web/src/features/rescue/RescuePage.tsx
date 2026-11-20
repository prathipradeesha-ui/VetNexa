import { Megaphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { useCurrentUser } from '../auth/useAuth';
import { RescueRow } from './RescueBits';
import { useRescueReports, type RescueView } from './useRescue';
import './rescue.css';

/**
 * Rescuers and admins: the rescue board in tabs. Everyone else: the reports they made.
 */
export function RescuePage() {
  const { data: user } = useCurrentUser();
  const isResponder = user?.role === 'RESCUER' || user?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const tabs: { id: RescueView; label: string }[] = [
    { id: 'open', label: 'Needs help' },
    ...(user?.role === 'RESCUER' ? [{ id: 'mine' as const, label: 'My rescues' }] : []),
    { id: 'resolved', label: 'Resolved' },
  ];
  const requested = params.get('view') as RescueView | null;
  const view = isResponder && tabs.some((t) => t.id === requested) ? requested! : 'open';
  const reports = useRescueReports(view);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{isResponder ? 'Rescue board' : 'My rescue reports'}</h1>
          <p>
            {isResponder
              ? 'Animals reported by the community, most urgent first.'
              : 'Animals you have reported and how their rescue is going.'}
          </p>
        </div>
        <Link to="/dashboard/rescue/new" className="btn btn--primary">
          <Megaphone size={18} aria-hidden="true" /> Report an animal
        </Link>
      </div>

      {isResponder && (
        <div className="tabs" role="tablist" aria-label="Rescue reports">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              className="tabs__tab"
              onClick={() => setParams({ view: tab.id }, { replace: true })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="card consultation-list" role={isResponder ? 'tabpanel' : undefined}>
        {reports.isPending && <PageLoader label="Loading reports…" />}
        {reports.isError && <Alert tone="error">{reports.error.message}</Alert>}
        {reports.isSuccess && reports.data.length === 0 && (
          <div className="empty-state">
            <p>
              {isResponder
                ? view === 'open'
                  ? 'No animals are waiting for help right now.'
                  : 'Nothing here yet.'
                : 'You have not reported any animals. If you see an animal in trouble, report it here.'}
            </p>
          </div>
        )}
        {reports.isSuccess && reports.data.length > 0 && (
          <ul>
            {reports.data.map((report) => (
              <li key={report.id}>
                <RescueRow report={report} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
