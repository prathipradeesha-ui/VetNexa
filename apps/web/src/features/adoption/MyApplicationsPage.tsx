import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@vetnexa/shared';
import { HeartHandshake } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { formatDate } from '../pets/format';
import { ListingPhoto } from './ListingBits';
import { useMyApplications, useWithdrawApplication } from './useAdoption';
import './adoption.css';

const tone: Record<ApplicationStatus, string> = {
  SUBMITTED: 'badge--warning',
  UNDER_REVIEW: 'badge--info',
  APPROVED: '',
  REJECTED: 'badge--neutral',
  WITHDRAWN: 'badge--neutral',
};

/** An owner's adoption applications with the rescuer's response. */
export function MyApplicationsPage() {
  const applications = useMyApplications();
  const withdraw = useWithdrawApplication();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My adoption applications</h1>
          <p>Follow your applications and read messages from rescuers.</p>
        </div>
        <Link to="/adopt" className="btn btn--primary">
          <HeartHandshake size={18} aria-hidden="true" /> Browse animals
        </Link>
      </div>

      {applications.isPending && <PageLoader />}
      {applications.isError && <Alert tone="error">{applications.error.message}</Alert>}
      {withdraw.isError && <Alert tone="error">{withdraw.error.message}</Alert>}
      {applications.isSuccess && applications.data.length === 0 && (
        <div className="card empty-state">
          <p>You have not applied to adopt an animal yet.</p>
          <Link to="/adopt" className="btn btn--secondary btn--sm">
            See animals looking for a home
          </Link>
        </div>
      )}
      {applications.isSuccess && applications.data.length > 0 && (
        <ul className="application-list">
          {applications.data.map((application) => (
            <li key={application.id} className="card application-card">
              <ListingPhoto listing={application.listing} className="application-card__photo" />
              <div className="application-card__body">
                <div className="adopt-card__title">
                  <h2>
                    <Link to={`/adopt/${application.listing.id}`}>{application.listing.name}</Link>
                  </h2>
                  <span className={`badge ${tone[application.status]}`}>
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </span>
                </div>
                <p className="muted">
                  Applied on {formatDate(application.createdAt.slice(0, 10))} ·{' '}
                  {application.listing.city}
                </p>
                {application.rescuerNotes && (
                  <div className="callout">
                    <strong>Message from the rescuer</strong>
                    <p>{application.rescuerNotes}</p>
                  </div>
                )}
                {application.status === 'APPROVED' && (
                  <Alert tone="success">
                    Congratulations! The rescuer will contact you to arrange bringing{' '}
                    {application.listing.name} home.
                  </Alert>
                )}
                {['SUBMITTED', 'UNDER_REVIEW'].includes(application.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => withdraw.mutate(application.id)}
                    loading={withdraw.isPending && withdraw.variables === application.id}
                  >
                    Withdraw application
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
