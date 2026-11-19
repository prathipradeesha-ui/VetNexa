import { ROLE_LABELS } from '@vetnexa/shared';
import { Mail, MapPin, Phone, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { useLocation } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { useCurrentUser } from '../auth/useAuth';
import { CareRemindersCard } from './CareRemindersCard';
import { MyPetsCard } from './MyPetsCard';
import { PendingVetsCard } from './PendingVetsCard';
import './dashboard.css';

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const justRegistered = (location.state as { welcome?: boolean } | null)?.welcome === true;

  if (!user) return <PageLoader />;

  const vetAwaitingVerification = user.role === 'VET' && !user.vetProfile?.isVerified;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>
            {greeting()}, {user.firstName}
          </h1>
          <p>Here is an overview of your VetNexa account.</p>
        </div>
      </div>

      {justRegistered && (
        <Alert tone="success" title="Welcome to VetNexa!">
          Your account has been created and you are signed in.
        </Alert>
      )}
      {vetAwaitingVerification && (
        <Alert tone="warning" title="Licence verification in progress">
          An administrator is checking licence {user.vetProfile?.licenseNumber}. You will be able to
          view patient records and manage consultations once it is approved.
        </Alert>
      )}

      <div className="dashboard-grid">
        <section className="card profile-card" aria-labelledby="profile-heading">
          <div className="profile-card__header">
            <span className="profile-card__avatar" aria-hidden="true">
              <UserRound size={28} />
            </span>
            <div>
              <h2 id="profile-heading">{user.fullName}</h2>
              <span className="badge">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>
                <Mail size={16} aria-hidden="true" /> Email
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <Phone size={16} aria-hidden="true" /> Mobile
              </dt>
              <dd>{user.phone ?? <span className="muted">Not added</span>}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={16} aria-hidden="true" /> City
              </dt>
              <dd>{user.city ?? <span className="muted">Not added</span>}</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={16} aria-hidden="true" /> Member since
              </dt>
              <dd>{dateFormat.format(new Date(user.createdAt))}</dd>
            </div>
          </dl>
        </section>

        {user.vetProfile && (
          <section className="card" aria-labelledby="vet-heading">
            <h2 id="vet-heading" className="card-title">
              <Stethoscope size={20} aria-hidden="true" /> Professional details
            </h2>
            <dl className="detail-list">
              <div>
                <dt>Licence number</dt>
                <dd>{user.vetProfile.licenseNumber}</dd>
              </div>
              <div>
                <dt>Specialisation</dt>
                <dd>
                  {user.vetProfile.specialization ?? <span className="muted">Not added</span>}
                </dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>
                  {user.vetProfile.isVerified ? (
                    <span className="badge">Verified</span>
                  ) : (
                    <span className="badge badge--warning">Pending review</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {user.role === 'OWNER' && <CareRemindersCard />}
        {user.role === 'OWNER' && <MyPetsCard />}
        {user.role === 'ADMIN' && <PendingVetsCard />}
      </div>
    </>
  );
}
