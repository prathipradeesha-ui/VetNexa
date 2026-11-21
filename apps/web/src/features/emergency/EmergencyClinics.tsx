import { Crosshair, Navigation, Phone, Siren } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MapView, type MapPlace } from '../../components/maps/MapView';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { directionsUrl, distanceKm, formatDistance, useGeolocation } from '../../lib/maps';
import { useClinicSearch } from '../clinics/useClinics';

/** Emergency and 24-hour clinics, nearest first once the user shares their location. */
export function EmergencyClinics() {
  const search = useClinicSearch({ emergency: true, sort: 'rating' });
  const geo = useGeolocation();
  const me = geo.state.status === 'ready' ? geo.state.position : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clinics = useMemo(() => {
    const list = (search.data?.clinics ?? []).map((clinic) => ({
      clinic,
      distance:
        me && clinic.latitude !== null && clinic.longitude !== null
          ? distanceKm(me, { lat: clinic.latitude, lng: clinic.longitude })
          : null,
    }));
    if (me) list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return list;
  }, [search.data, me]);

  const places: MapPlace[] = clinics
    .filter(({ clinic }) => clinic.latitude !== null && clinic.longitude !== null)
    .map(({ clinic, distance }) => ({
      id: clinic.id,
      position: { lat: clinic.latitude!, lng: clinic.longitude! },
      title: clinic.name,
      subtitle: [clinic.phone, distance !== null ? formatDistance(distance) : null]
        .filter(Boolean)
        .join(' · '),
      href: `/clinics/${clinic.slug}`,
      highlight: true,
    }));
  const nearest = clinics[0]?.clinic;

  return (
    <section className="card emergency-section" aria-labelledby="emergency-clinics-title">
      <h2 id="emergency-clinics-title" className="card-title">
        <Siren size={20} aria-hidden="true" /> Emergency clinics
      </h2>
      <div className="emergency-clinics__actions">
        <Button
          onClick={geo.locate}
          loading={geo.state.status === 'locating'}
          loadingText="Finding you…"
          variant={me ? 'secondary' : 'primary'}
        >
          <Crosshair size={18} aria-hidden="true" />{' '}
          {me ? 'Update my location' : 'Find the nearest'}
        </Button>
        {me && nearest && (
          <a href={`tel:${nearest.phone}`} className="btn btn--primary emergency-call">
            <Phone size={18} aria-hidden="true" /> Call {nearest.name}
          </a>
        )}
      </div>
      {geo.state.status === 'error' && <Alert tone="info">{geo.state.message}</Alert>}
      <p className="field__hint">
        Your location stays on your device; it is only used to sort clinics by distance.
      </p>

      {search.isError && <Alert tone="error">{search.error.message}</Alert>}
      {search.isSuccess && clinics.length === 0 && (
        <p>
          No emergency clinics are listed yet. <Link to="/clinics">See all clinics</Link>.
        </p>
      )}
      {places.length > 0 && (
        <MapView
          label="Map of emergency clinics"
          places={places}
          selectedId={selectedId ?? places[0]?.id ?? null}
          onSelect={setSelectedId}
          userLocation={me}
          height={300}
        />
      )}
      <ul className="emergency-clinic-list">
        {clinics.slice(0, 6).map(({ clinic, distance }) => (
          <li key={clinic.id}>
            <div>
              <strong>{clinic.name}</strong>
              <span>
                {clinic.city}
                {clinic.isOpen24Hours ? ' · Open 24 hours' : clinic.isOpenNow ? ' · Open now' : ''}
                {distance !== null && ` · ${formatDistance(distance)}`}
              </span>
            </div>
            <div className="emergency-clinic-list__actions">
              <a href={`tel:${clinic.phone}`} className="btn btn--primary btn--sm">
                <Phone size={15} aria-hidden="true" /> Call
              </a>
              <a
                href={directionsUrl(
                  clinic.latitude !== null && clinic.longitude !== null
                    ? { lat: clinic.latitude, lng: clinic.longitude }
                    : `${clinic.name}, ${clinic.city}, Sri Lanka`,
                )}
                target="_blank"
                rel="noreferrer"
                className="btn btn--secondary btn--sm"
              >
                <Navigation size={15} aria-hidden="true" /> Directions
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
