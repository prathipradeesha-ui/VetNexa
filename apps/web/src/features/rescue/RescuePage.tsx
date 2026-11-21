import { List, Map as MapIcon, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MapView, type MapPlace } from '../../components/maps/MapView';
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
  const [display, setDisplay] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const places: MapPlace[] = (reports.data ?? [])
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      id: r.id,
      position: { lat: r.latitude!, lng: r.longitude! },
      title: r.title,
      subtitle: `${r.locationText}, ${r.city}${r.locationApproximate ? ' · approximate area' : ''}`,
      href: `/dashboard/rescue/${r.id}`,
      highlight: r.urgency === 'CRITICAL' || r.urgency === 'HIGH',
      approximateRadiusM: r.locationApproximate ? 1000 : undefined,
    }));

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

      {isResponder && (
        <div className="clinic-view-toggle" role="group" aria-label="Show reports as">
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={display === 'list'}
            onClick={() => setDisplay('list')}
          >
            <List size={16} aria-hidden="true" /> List
          </button>
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={display === 'map'}
            onClick={() => setDisplay('map')}
          >
            <MapIcon size={16} aria-hidden="true" /> Map
          </button>
        </div>
      )}

      {isResponder && display === 'map' && reports.isSuccess && (
        <div className="rescue-board-map">
          <MapView
            label="Map of rescue reports"
            places={places}
            selectedId={selectedId ?? places[0]?.id ?? null}
            onSelect={setSelectedId}
            height={460}
          />
          <p className="field__hint">
            {places.length} of {reports.data.length} reports have a location. Red areas are
            approximate; the exact spot is shown once you take a report on.
          </p>
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
                : 'You have not reported any animals. If you see a dog or cat in trouble, report it here.'}
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
