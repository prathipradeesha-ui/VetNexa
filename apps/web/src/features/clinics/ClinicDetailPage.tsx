import { clinicLocalTime, WEEK_DAY_LABELS, WEEK_DAYS } from '@vetnexa/shared';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Siren,
  Stethoscope,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { StarRating } from '../../components/ui/Stars';
import { OpenBadge } from './ClinicsPage';
import { ReviewSection } from './ReviewSection';
import { useClinic, type ClinicDetail } from './useClinics';
import './clinics.css';

export function ClinicDetailPage() {
  const { slug = '' } = useParams();
  const clinic = useClinic(slug);

  return (
    <div className="container clinic-detail">
      <Link to="/clinics" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> All clinics
      </Link>
      {clinic.isPending && <PageLoader label="Loading clinic…" />}
      {clinic.isError && <Alert tone="error">{clinic.error.message}</Alert>}
      {clinic.isSuccess && <ClinicProfile clinic={clinic.data} />}
    </div>
  );
}

function ClinicProfile({ clinic }: { clinic: ClinicDetail }) {
  const today = clinicLocalTime(new Date()).day;
  const mapUrl =
    clinic.latitude !== null && clinic.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${clinic.latitude},${clinic.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name} ${clinic.addressLine} ${clinic.city}`)}`;

  return (
    <>
      <header className="clinic-header">
        <div className="clinic-card__badges">
          <OpenBadge clinic={clinic} />
          {(clinic.hasEmergency || clinic.isOpen24Hours) && (
            <span className="badge badge--danger">
              <Siren size={12} aria-hidden="true" /> Emergency care
            </span>
          )}
        </div>
        <h1>{clinic.name}</h1>
        <p className="clinic-header__meta">
          {clinic.reviewCount > 0 ? (
            <>
              <StarRating value={clinic.averageRating} size={18} />
              <strong>{clinic.averageRating.toFixed(1)}</strong>
              <a href="#reviews">
                {clinic.reviewCount} review{clinic.reviewCount === 1 ? '' : 's'}
              </a>
            </>
          ) : (
            <span className="muted">No reviews yet</span>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {clinic.city}, {clinic.district} District
          </span>
        </p>
      </header>

      <div className="clinic-layout">
        <div className="clinic-layout__main">
          {clinic.description && (
            <section className="card" aria-labelledby="about-heading">
              <h2 id="about-heading">About the clinic</h2>
              <p className="clinic-description">{clinic.description}</p>
              <h3 className="clinic-subheading">Services</h3>
              <ul className="service-tags">
                {clinic.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </section>
          )}

          {clinic.vets.length > 0 && (
            <section className="card" aria-labelledby="vets-heading">
              <h2 id="vets-heading">Veterinarians</h2>
              <ul className="vet-list">
                {clinic.vets.map((vet) => (
                  <li key={vet.id}>
                    <span className="vet-list__icon" aria-hidden="true">
                      <Stethoscope size={18} />
                    </span>
                    <div>
                      <strong>{vet.name}</strong>
                      <span>
                        {[
                          vet.specialization,
                          vet.yearsExperience ? `${vet.yearsExperience} years’ experience` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'General practice'}
                      </span>
                    </div>
                    <span className="badge">Verified</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ReviewSection clinic={clinic} />
        </div>

        <aside className="clinic-layout__side">
          <section className="card" aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact</h2>
            <ul className="contact-list">
              <li>
                <Phone size={18} aria-hidden="true" />
                <div>
                  <strong>
                    <a href={`tel:${clinic.phone}`}>{clinic.phone}</a>
                  </strong>
                  <span>Phone</span>
                </div>
              </li>
              {clinic.email && (
                <li>
                  <Mail size={18} aria-hidden="true" />
                  <div>
                    <strong>
                      <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
                    </strong>
                    <span>Email</span>
                  </div>
                </li>
              )}
              {clinic.website && (
                <li>
                  <Globe size={18} aria-hidden="true" />
                  <div>
                    <strong>
                      <a href={clinic.website} target="_blank" rel="noopener noreferrer">
                        {clinic.website.replace(/^https?:\/\//, '')}
                      </a>
                    </strong>
                    <span>Website</span>
                  </div>
                </li>
              )}
              <li>
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <strong>{clinic.addressLine}</strong>
                  <span>
                    {clinic.city}, {clinic.district}
                  </span>
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="map-link">
                    Get directions <ExternalLink size={13} aria-hidden="true" />
                    <span className="sr-only">(opens Google Maps in a new tab)</span>
                  </a>
                </div>
              </li>
            </ul>
          </section>

          <section className="card" aria-labelledby="hours-heading">
            <h2 id="hours-heading">Opening hours</h2>
            {clinic.isOpen24Hours ? (
              <p>Open 24 hours, every day, including emergencies.</p>
            ) : (
              <table className="hours-table">
                <tbody>
                  {WEEK_DAYS.map((day) => {
                    const value = clinic.openingHours[day] ?? 'Closed';
                    return (
                      <tr key={day} className={day === today ? 'is-today' : undefined}>
                        <th scope="row">
                          {WEEK_DAY_LABELS[day]}
                          {day === today && <span className="sr-only"> (today)</span>}
                        </th>
                        <td>{value === 'Closed' ? 'Closed' : value.replace('-', ' – ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="field__hint">Times are Sri Lanka time. Call ahead on public holidays.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
