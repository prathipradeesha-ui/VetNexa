import { CalendarPlus, Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ConsultationRow } from '../consultations/ConsultationBits';
import { useConsultations } from '../consultations/useConsultations';

/** Owner dashboard card: the next three appointments. */
export function UpcomingConsultationsCard() {
  const upcoming = useConsultations('upcoming');

  return (
    <section className="card" aria-labelledby="appointments-heading">
      <div className="card-heading-row">
        <h2 id="appointments-heading" className="card-title">
          <Stethoscope size={20} aria-hidden="true" /> Appointments
        </h2>
        <Link to="/dashboard/consultations/new" className="card-link">
          Book
        </Link>
      </div>
      {upcoming.isPending && <p className="muted">Loading appointments…</p>}
      {upcoming.isError && <Alert tone="error">{upcoming.error.message}</Alert>}
      {upcoming.isSuccess && upcoming.data.length === 0 && (
        <div className="empty-state">
          <p>No upcoming appointments.</p>
          <Link to="/dashboard/consultations/new" className="btn btn--secondary btn--sm">
            <CalendarPlus size={16} aria-hidden="true" /> Book a consultation
          </Link>
        </div>
      )}
      {upcoming.isSuccess && upcoming.data.length > 0 && (
        <ul className="plain-list">
          {upcoming.data.slice(0, 3).map((consultation) => (
            <li key={consultation.id}>
              <ConsultationRow consultation={consultation} perspective="OWNER" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
