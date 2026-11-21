import { RESCUE_URGENCY_LABELS, SPECIES_LABELS } from '@vetnexa/shared';
import { ArrowLeft, ExternalLink, HandHeart, MapPin, Phone } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { MapView } from '../../components/maps/MapView';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { PhotoPicker } from '../../components/ui/PhotoPicker';
import { directionsUrl, placeUrl } from '../../lib/maps';
import { RescueStatusBadge, timeAgo, UrgencyBadge } from './RescueBits';
import { useRescueActions, useRescueReport, type RescueReport } from './useRescue';
import '../pets/pets.css';
import './rescue.css';

export function RescueDetailPage() {
  const { id = '' } = useParams();
  const report = useRescueReport(id);
  return (
    <>
      <Link to="/dashboard/rescue" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to reports
      </Link>
      {report.isPending && <PageLoader />}
      {report.isError && <Alert tone="error">{report.error.message}</Alert>}
      {report.isSuccess && <ReportDetail report={report.data} />}
    </>
  );
}

function ReportDetail({ report }: { report: RescueReport }) {
  const location = useLocation();
  const { takeOn, setStatus, uploadPhoto } = useRescueActions(report.id);
  const position =
    report.latitude !== null && report.longitude !== null
      ? { lat: report.latitude, lng: report.longitude }
      : null;
  const mapUrl =
    position && !report.locationApproximate
      ? directionsUrl(position)
      : placeUrl(`${report.locationText}, ${report.city}, Sri Lanka`);
  const busy = takeOn.isPending || setStatus.isPending;
  const error = takeOn.error ?? setStatus.error;

  return (
    <>
      {(location.state as { created?: boolean } | null)?.created && (
        <Alert tone="success" title="Thank you for reporting">
          Rescuers have been notified. Adding a photo helps them recognise the animal.
        </Alert>
      )}
      <div className="page-header">
        <div>
          <h1>{report.title}</h1>
          <p>
            {SPECIES_LABELS[report.species]} · reported {timeAgo(report.createdAt)} by{' '}
            {report.reporter.isMe ? 'you' : report.reporter.name}
          </p>
        </div>
        <div className="rescue-row__badges">
          <UrgencyBadge urgency={report.urgency} />
          <RescueStatusBadge status={report.status} />
        </div>
      </div>

      <div className="consultation-layout">
        <div className="consultation-layout__main">
          <section className="card" aria-labelledby="situation-heading">
            <h2 id="situation-heading" className="card-title">
              The situation
            </h2>
            {report.photoUrl && (
              <img
                src={report.photoUrl}
                alt={`Photo of ${report.title}`}
                className="rescue-photo"
              />
            )}
            <p className="pre-line">{report.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Urgency</dt>
                <dd>{RESCUE_URGENCY_LABELS[report.urgency]}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {report.locationText}, {report.city}
                  <br />
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="map-link">
                    <MapPin size={14} aria-hidden="true" /> Open in Google Maps{' '}
                    <ExternalLink size={12} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </dd>
              </div>
            </dl>
            {position && (
              <div className="rescue-map">
                <MapView
                  label="Where the animal was seen"
                  places={[
                    {
                      id: report.id,
                      position,
                      title: report.locationApproximate ? 'Approximate area' : report.locationText,
                      approximateRadiusM: report.locationApproximate ? 1000 : undefined,
                      highlight: true,
                    },
                  ]}
                  selectedId={report.id}
                  height={240}
                />
                {report.locationApproximate && (
                  <p className="field__hint">
                    For the reporter's safety, the exact spot is shown once you take this report on.
                  </p>
                )}
              </div>
            )}
            {report.actions.canChangePhoto && (
              <PhotoPicker
                label="Upload a photo of the animal"
                hasPhoto={Boolean(report.photoUrl)}
                uploading={uploadPhoto.isPending}
                onUpload={(file, onError) =>
                  uploadPhoto.mutate(file, { onError: (e) => onError(e.message) })
                }
              />
            )}
          </section>
        </div>

        <aside className="consultation-layout__side">
          {(report.reporter.phone || report.assignedTo) && (
            <section className="card" aria-labelledby="contacts-heading">
              <h2 id="contacts-heading" className="card-title">
                Contacts
              </h2>
              <ul className="contact-list">
                {report.reporter.phone && !report.reporter.isMe && (
                  <li>
                    <Phone size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        <a href={`tel:${report.reporter.phone}`}>{report.reporter.phone}</a>
                      </strong>
                      <span>Reporter: {report.reporter.name}</span>
                    </div>
                  </li>
                )}
                {report.assignedTo && (
                  <li>
                    <HandHeart size={18} aria-hidden="true" />
                    <div>
                      <strong>
                        {report.assignedTo.isMe
                          ? 'You are handling this rescue'
                          : report.assignedTo.name}
                      </strong>
                      {report.assignedTo.phone && !report.assignedTo.isMe ? (
                        <a href={`tel:${report.assignedTo.phone}`}>{report.assignedTo.phone}</a>
                      ) : (
                        <span>Rescuer</span>
                      )}
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}

          {(report.actions.canTakeOn || report.actions.canResolve || report.actions.canClose) && (
            <section className="card consultation-actions" aria-labelledby="rescue-actions-heading">
              <h2 id="rescue-actions-heading" className="card-title">
                Actions
              </h2>
              {error && <Alert tone="error">{error.message}</Alert>}
              {report.actions.canTakeOn && (
                <Button
                  block
                  onClick={() => takeOn.mutate()}
                  loading={takeOn.isPending}
                  disabled={busy}
                >
                  <HandHeart size={18} aria-hidden="true" /> I’ll take this rescue
                </Button>
              )}
              {report.actions.canResolve && (
                <Button block onClick={() => setStatus.mutate('RESCUED')} disabled={busy}>
                  Mark as rescued
                </Button>
              )}
              {(report.actions.canClose || report.actions.canResolve) && (
                <Button
                  variant="ghost"
                  block
                  onClick={() => setStatus.mutate('CLOSED')}
                  disabled={busy}
                >
                  {report.reporter.isMe && report.status === 'OPEN'
                    ? 'Close report (no longer needed)'
                    : 'Close without rescue'}
                </Button>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
