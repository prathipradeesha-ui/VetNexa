import { Clock, MapPin, Phone, Search, Siren, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { StarRating } from '../../components/ui/Stars';
import { useClinicSearch, type ClinicFilters, type ClinicSummary } from './useClinics';
import './clinics.css';

/** Reads the filters from the address bar, so searches can be bookmarked and shared. */
function useFiltersFromUrl(): [ClinicFilters, (next: ClinicFilters) => void] {
  const [params, setParams] = useSearchParams();
  const filters: ClinicFilters = {
    q: params.get('q') ?? undefined,
    city: params.get('city') ?? undefined,
    service: params.get('service') ?? undefined,
    emergency: params.get('emergency') === 'true',
    openNow: params.get('openNow') === 'true',
    sort: params.get('sort') === 'name' ? 'name' : 'rating',
  };
  const update = (next: ClinicFilters) => {
    const merged = { ...filters, ...next };
    const out = new URLSearchParams();
    if (merged.q) out.set('q', merged.q);
    if (merged.city) out.set('city', merged.city);
    if (merged.service) out.set('service', merged.service);
    if (merged.emergency) out.set('emergency', 'true');
    if (merged.openNow) out.set('openNow', 'true');
    if (merged.sort === 'name') out.set('sort', 'name');
    setParams(out, { replace: true });
  };
  return [filters, update];
}

export function ClinicsPage() {
  const [filters, setFilters] = useFiltersFromUrl();
  const [text, setText] = useState(filters.q ?? '');
  const search = useClinicSearch(filters);
  const hasFilters = Boolean(
    filters.q || filters.city || filters.service || filters.emergency || filters.openNow,
  );

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ q: text.trim() || undefined });
  };
  const clearAll = () => {
    setText('');
    setFilters({
      q: undefined,
      city: undefined,
      service: undefined,
      emergency: false,
      openNow: false,
    });
  };

  return (
    <>
      <section className="page-hero clinics-hero">
        <div className="container">
          <span className="eyebrow">Clinic discovery</span>
          <h1>Find a veterinary clinic</h1>
          <p className="lead">
            Search clinics across Sri Lanka by location and service, check opening hours and read
            reviews from other pet owners.
          </p>
          <form className="clinic-search" role="search" onSubmit={onSearch}>
            <label htmlFor="clinic-q" className="sr-only">
              Search clinics
            </label>
            <Search size={20} className="clinic-search__icon" aria-hidden="true" />
            <input
              id="clinic-q"
              className="input clinic-search__input"
              type="search"
              placeholder="Clinic name, town or district"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" className="btn btn--primary">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="section clinics-section">
        <div className="container">
          <div className="clinic-filters" role="group" aria-label="Filters">
            <select
              className="select"
              aria-label="City"
              value={filters.city ?? ''}
              onChange={(event) => setFilters({ city: event.target.value || undefined })}
            >
              <option value="">All cities</option>
              {search.data?.facets.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Service"
              value={filters.service ?? ''}
              onChange={(event) => setFilters({ service: event.target.value || undefined })}
            >
              <option value="">All services</option>
              {search.data?.facets.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={filters.emergency ?? false}
                onChange={(event) => setFilters({ emergency: event.target.checked })}
              />
              <Siren size={16} aria-hidden="true" /> Emergency care
            </label>
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={filters.openNow ?? false}
                onChange={(event) => setFilters({ openNow: event.target.checked })}
              />
              <Clock size={16} aria-hidden="true" /> Open now
            </label>
            <select
              className="select clinic-filters__sort"
              aria-label="Sort by"
              value={filters.sort}
              onChange={(event) => setFilters({ sort: event.target.value as 'rating' | 'name' })}
            >
              <option value="rating">Highest rated</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          <div className="clinic-results__summary" aria-live="polite">
            {search.isSuccess && (
              <p>
                {search.data.total} clinic{search.data.total === 1 ? '' : 's'} found
                {hasFilters && (
                  <button type="button" className="link-button" onClick={clearAll}>
                    <X size={14} aria-hidden="true" /> Clear filters
                  </button>
                )}
              </p>
            )}
          </div>

          {search.isPending && <p className="muted">Loading clinics…</p>}
          {search.isError && <Alert tone="error">{search.error.message}</Alert>}

          {search.isSuccess && search.data.total === 0 && (
            <div className="card empty-state">
              <p>No clinics match these filters. Try another city or fewer filters.</p>
              <button type="button" className="btn btn--secondary btn--sm" onClick={clearAll}>
                Clear filters
              </button>
            </div>
          )}

          {search.isSuccess && search.data.total > 0 && (
            <ul className={`clinic-grid ${search.isPlaceholderData ? 'is-updating' : ''}`}>
              {search.data.clinics.map((clinic) => (
                <li key={clinic.id}>
                  <ClinicCard clinic={clinic} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function ClinicCard({ clinic }: { clinic: ClinicSummary }) {
  return (
    <article className="card clinic-card">
      <div className="clinic-card__badges">
        <OpenBadge clinic={clinic} />
        {(clinic.hasEmergency || clinic.isOpen24Hours) && (
          <span className="badge badge--danger">
            <Siren size={12} aria-hidden="true" /> Emergency
          </span>
        )}
      </div>
      <h2 className="clinic-card__name">
        <Link to={`/clinics/${clinic.slug}`}>{clinic.name}</Link>
      </h2>
      <p className="clinic-card__rating">
        {clinic.reviewCount > 0 ? (
          <>
            <StarRating value={clinic.averageRating} />
            <strong>{clinic.averageRating.toFixed(1)}</strong>
            <span className="muted">
              ({clinic.reviewCount} review{clinic.reviewCount === 1 ? '' : 's'})
            </span>
          </>
        ) : (
          <span className="muted">No reviews yet</span>
        )}
      </p>
      <p className="clinic-card__line">
        <MapPin size={15} aria-hidden="true" /> {clinic.addressLine}, {clinic.city}
      </p>
      <p className="clinic-card__line">
        <Phone size={15} aria-hidden="true" /> <a href={`tel:${clinic.phone}`}>{clinic.phone}</a>
      </p>
      <ul className="service-tags" aria-label="Services">
        {clinic.services.slice(0, 4).map((service) => (
          <li key={service}>{service}</li>
        ))}
        {clinic.services.length > 4 && <li>+{clinic.services.length - 4} more</li>}
      </ul>
    </article>
  );
}

export function OpenBadge({
  clinic,
}: {
  clinic: Pick<ClinicSummary, 'isOpenNow' | 'isOpen24Hours'>;
}) {
  if (clinic.isOpen24Hours) return <span className="badge">Open 24 hours</span>;
  return clinic.isOpenNow ? (
    <span className="badge">Open now</span>
  ) : (
    <span className="badge badge--neutral">Closed now</span>
  );
}
