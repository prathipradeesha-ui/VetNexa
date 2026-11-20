import { CalendarPlus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { useCurrentUser } from '../auth/useAuth';
import { ConsultationRow } from './ConsultationBits';
import { useConsultations, type ConsultationView } from './useConsultations';
import './consultations.css';

const emptyMessages: Record<ConsultationView, string> = {
  upcoming: 'No upcoming consultations.',
  requests: 'No new requests. You are all caught up.',
  past: 'No past consultations yet.',
  all: 'No consultations yet.',
};

/** Consultation lists for owners (their bookings) and vets (their schedule), in tabs. */
export function ConsultationsPage() {
  const { data: user } = useCurrentUser();
  const isVet = user?.role === 'VET';
  const [params, setParams] = useSearchParams();
  const tabs: { id: ConsultationView; label: string }[] = isVet
    ? [
        { id: 'requests', label: 'New requests' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'past', label: 'Past' },
      ]
    : [
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'past', label: 'Past' },
      ];
  const requested = params.get('view') as ConsultationView | null;
  const view = tabs.some((tab) => tab.id === requested) ? requested! : tabs[0]!.id;
  const list = useConsultations(view);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{isVet ? 'Consultations' : 'My consultations'}</h1>
          <p>
            {isVet
              ? 'Review requests, manage your schedule and record outcomes.'
              : 'Book appointments with verified veterinarians and follow their outcome.'}
          </p>
        </div>
        {!isVet && (
          <Link to="/dashboard/consultations/new" className="btn btn--primary">
            <CalendarPlus size={18} aria-hidden="true" /> Book a consultation
          </Link>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Consultation lists">
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

      <div className="card consultation-list" role="tabpanel">
        {list.isPending && <PageLoader label="Loading consultations…" />}
        {list.isError && <Alert tone="error">{list.error.message}</Alert>}
        {list.isSuccess && list.data.length === 0 && (
          <div className="empty-state">
            <p>{emptyMessages[view]}</p>
            {!isVet && view === 'upcoming' && (
              <Link to="/dashboard/consultations/new" className="btn btn--secondary btn--sm">
                Book a consultation
              </Link>
            )}
          </div>
        )}
        {list.isSuccess && list.data.length > 0 && (
          <ul>
            {list.data.map((consultation) => (
              <li key={consultation.id}>
                <ConsultationRow
                  consultation={consultation}
                  perspective={isVet ? 'VET' : 'OWNER'}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
