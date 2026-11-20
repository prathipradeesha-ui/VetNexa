import { AGE_GROUP_LABELS, AGE_GROUPS, SPECIES, SPECIES_LABELS } from '@vetnexa/shared';
import { Baby, HeartHandshake } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ListingLocation, ListingPhoto, ListingStatusBadge, listingSummary } from './ListingBits';
import { useListings, type ListingFilters } from './useAdoption';
import './adoption.css';

/** Public page: animals looking for a home, with filters kept in the address bar. */
export function AdoptPage() {
  const [params, setParams] = useSearchParams();
  const filters: ListingFilters = {
    species: params.get('species') ?? undefined,
    ageGroup: params.get('ageGroup') ?? undefined,
    city: params.get('city') ?? undefined,
    goodWithChildren: params.get('goodWithChildren') === 'true',
  };
  const listings = useListings(filters);

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Adopt, don’t shop</span>
          <h1>Give a rescued animal a home</h1>
          <p className="lead">
            Every animal here was rescued and cared for by a registered rescuer. Apply online and
            the rescuer will contact you to arrange a meeting.
          </p>
        </div>
      </section>

      <section className="section clinics-section">
        <div className="container">
          <div className="adopt-filters" role="group" aria-label="Filters">
            <select
              className="select"
              aria-label="Species"
              value={filters.species ?? ''}
              onChange={(event) => update('species', event.target.value || undefined)}
            >
              <option value="">All animals</option>
              {SPECIES.map((species) => (
                <option key={species} value={species}>
                  {SPECIES_LABELS[species]}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Age"
              value={filters.ageGroup ?? ''}
              onChange={(event) => update('ageGroup', event.target.value || undefined)}
            >
              <option value="">Any age</option>
              {AGE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {AGE_GROUP_LABELS[group]}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="City"
              value={filters.city ?? ''}
              onChange={(event) => update('city', event.target.value || undefined)}
            >
              <option value="">All cities</option>
              {listings.data?.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <label className="toggle-chip">
              <input
                type="checkbox"
                checked={filters.goodWithChildren ?? false}
                onChange={(event) =>
                  update('goodWithChildren', event.target.checked ? 'true' : undefined)
                }
              />
              <Baby size={16} aria-hidden="true" /> Good with children
            </label>
          </div>

          {listings.isPending && <p className="muted">Loading animals…</p>}
          {listings.isError && <Alert tone="error">{listings.error.message}</Alert>}
          {listings.isSuccess && listings.data.listings.length === 0 && (
            <div className="card empty-state">
              <HeartHandshake size={28} aria-hidden="true" />
              <p>No animals match these filters right now. New animals are added every week.</p>
            </div>
          )}
          {listings.isSuccess && listings.data.listings.length > 0 && (
            <ul className={`adopt-grid ${listings.isPlaceholderData ? 'is-updating' : ''}`}>
              {listings.data.listings.map((listing) => (
                <li key={listing.id}>
                  <article className="card adopt-card">
                    <ListingPhoto listing={listing} />
                    <div className="adopt-card__body">
                      <div className="adopt-card__title">
                        <h2>
                          <Link to={`/adopt/${listing.id}`}>{listing.name}</Link>
                        </h2>
                        <ListingStatusBadge status={listing.status} />
                      </div>
                      <p className="muted adopt-card__summary">{listingSummary(listing)}</p>
                      <ListingLocation city={listing.city} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
