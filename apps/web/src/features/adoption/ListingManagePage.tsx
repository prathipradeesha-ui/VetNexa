import { APPLICATION_STATUS_LABELS } from '@vetnexa/shared';
import { ArrowLeft, Baby, ExternalLink, Home, Mail, PawPrint, Pencil, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { PhotoPicker } from '../../components/ui/PhotoPicker';
import { formatDate } from '../pets/format';
import { ListingPhoto, ListingStatusBadge, listingSummary } from './ListingBits';
import { useApplicationsFor, useListingActions, type ReceivedApplication } from './useAdoption';
import './adoption.css';

/** Rescuer's page for one listing: photo, availability and the applications received. */
export function ListingManagePage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const data = useApplicationsFor(id);
  const { setStatus, uploadPhoto } = useListingActions(id);

  if (data.isPending) return <PageLoader />;
  if (data.isError) return <Alert tone="error">{data.error.message}</Alert>;
  const { listing, applications } = data.data;
  const open = applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW');
  const closed = applications.filter((a) => !open.includes(a));

  return (
    <>
      <Link to="/dashboard/listings" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> All listings
      </Link>
      {(location.state as { saved?: boolean } | null)?.saved && (
        <Alert tone="success">Listing saved.</Alert>
      )}

      <section className="card manage-listing">
        <div className="manage-listing__photo">
          <ListingPhoto listing={listing} className="listing-photo--large" />
          {listing.status !== 'ADOPTED' && (
            <PhotoPicker
              label={`Upload a photo of ${listing.name}`}
              hasPhoto={Boolean(listing.photoUrl)}
              uploading={uploadPhoto.isPending}
              onUpload={(file, onError) =>
                uploadPhoto.mutate(file, { onError: (e) => onError(e.message) })
              }
            />
          )}
        </div>
        <div>
          <div className="adopt-card__title">
            <h1>{listing.name}</h1>
            <ListingStatusBadge status={listing.status} />
          </div>
          <p className="muted">
            {listingSummary(listing)} · {listing.city}
          </p>
          <div className="manage-listing__actions">
            <Link to={`/adopt/${listing.id}`} className="btn btn--secondary btn--sm">
              <ExternalLink size={16} aria-hidden="true" /> View public page
            </Link>
            {listing.status !== 'ADOPTED' && (
              <Link
                to={`/dashboard/listings/${listing.id}/edit`}
                className="btn btn--secondary btn--sm"
              >
                <Pencil size={16} aria-hidden="true" /> Edit details
              </Link>
            )}
            {listing.status === 'WITHDRAWN' && (
              <Button
                size="sm"
                onClick={() => setStatus.mutate('AVAILABLE')}
                loading={setStatus.isPending}
              >
                Make available again
              </Button>
            )}
            {(listing.status === 'AVAILABLE' || listing.status === 'PENDING') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus.mutate('WITHDRAWN')}
                loading={setStatus.isPending}
              >
                Withdraw listing
              </Button>
            )}
          </div>
          {setStatus.isError && <Alert tone="error">{setStatus.error.message}</Alert>}
          {listing.status === 'ADOPTED' && (
            <Alert tone="success">{listing.name} has been adopted. Thank you for your work!</Alert>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="card-title">
          Applications ({open.length} open)
        </h2>
        {applications.length === 0 && <p className="muted">No applications yet.</p>}
        <ul className="received-list">
          {[...open, ...closed].map((application) => (
            <ApplicationReview
              key={application.id}
              listingId={listing.id}
              application={application}
              animalName={listing.name}
              canDecide={listing.status !== 'ADOPTED'}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function ApplicationReview({
  listingId,
  application,
  animalName,
  canDecide,
}: {
  listingId: string;
  application: ReceivedApplication;
  animalName: string;
  canDecide: boolean;
}) {
  const { decide } = useListingActions(listingId);
  const [note, setNote] = useState('');
  const isOpen = application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW';
  const send = (status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED') =>
    decide.mutate({
      applicationId: application.id,
      status,
      rescuerNotes: note.trim() || undefined,
    });

  return (
    <li className={`received ${isOpen ? '' : 'received--closed'}`}>
      <div className="received__header">
        <div>
          <strong>{application.applicant.name}</strong>
          <span className="muted">
            {' '}
            · applied {formatDate(application.createdAt.slice(0, 10))}
            {application.applicant.city ? ` · ${application.applicant.city}` : ''}
          </span>
        </div>
        <span className="badge badge--neutral">
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>
      <ul className="received__facts">
        <li>
          <Home size={14} aria-hidden="true" /> {application.homeType}
        </li>
        <li>
          <Baby size={14} aria-hidden="true" />{' '}
          {application.hasChildren ? 'Has children' : 'No children'}
        </li>
        <li>
          <PawPrint size={14} aria-hidden="true" />{' '}
          {application.hasOtherPets ? 'Has other pets' : 'No other pets'}
        </li>
        <li>
          <Phone size={14} aria-hidden="true" />{' '}
          <a href={`tel:${application.contactPhone}`}>{application.contactPhone}</a>
        </li>
        <li>
          <Mail size={14} aria-hidden="true" />{' '}
          <a href={`mailto:${application.applicant.email}`}>{application.applicant.email}</a>
        </li>
      </ul>
      <p className="pre-line">{application.message}</p>
      {application.rescuerNotes && <p className="muted">Your note: {application.rescuerNotes}</p>}

      {isOpen && canDecide && (
        <div className="received__decision">
          <label htmlFor={`note-${application.id}`} className="field__label">
            Message to the applicant <span className="field__optional">(optional)</span>
          </label>
          <textarea
            id={`note-${application.id}`}
            className="textarea"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {decide.isError && <Alert tone="error">{decide.error.message}</Alert>}
          <div className="form-actions">
            {application.status === 'SUBMITTED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => send('UNDER_REVIEW')}
                loading={decide.isPending && decide.variables?.status === 'UNDER_REVIEW'}
              >
                Mark under review
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => send('REJECTED')}
              loading={decide.isPending && decide.variables?.status === 'REJECTED'}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => send('APPROVED')}
              loading={decide.isPending && decide.variables?.status === 'APPROVED'}
            >
              Approve adoption
            </Button>
          </div>
          <p className="field__hint">
            Approving marks {animalName} as adopted and lets the other applicants know.
          </p>
        </div>
      )}
    </li>
  );
}
