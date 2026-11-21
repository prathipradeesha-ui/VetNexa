import { Crosshair, Navigation, Phone, Siren } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MapView, type MapPlace } from '../../components/maps/MapView';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { directionsUrl, distanceKm, formatDistance, useGeolocation } from '../../lib/maps';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';
import { useClinicSearch } from '../clinics/useClinics';
import { EMERGENCY_FILTERS, loadSavedClinics, saveClinics, type SavedClinic } from './savedClinics';

type ListedClinic = SavedClinic & { isOpenNow?: boolean };

const savedDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Emergency and 24-hour clinics, nearest first once the user shares their location. Without
 * internet it uses the list saved on the phone, so the call buttons still work.
 */
export function EmergencyClinics() {
  const search = useClinicSearch(EMERGENCY_FILTERS);
  const online = useOnlineStatus();
  const geo = useGeolocation();
  const me = geo.state.status === 'ready' ? geo.state.position : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (search.data) saveClinics(search.data.clinics);
  }, [search.data]);

  const live = search.data?.clinics;
  const saved = useMemo(
    () => (!live && (search.isError || !online) ? loadSavedClinics() : null),
    [live, search.isError, online],
  );

  const clinics = useMemo(() => {
    const source: ListedClinic[] = live ?? saved?.clinics ?? [];
    const list = source.map((clinic) => ({
      clinic,
      distance:
        me && clinic.latitude !== null && clinic.longitude !== null
          ? distanceKm(me, { lat: clinic.latitude, lng: clinic.longitude })
          : null,
    }));
    if (me) list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return list;
  }, [live, saved, me]);

  // The map needs internet, so offline it is left out and the list does the work.
  const places: MapPlace[] = !online
    ? []
    : clinics
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

      {saved && (
        <Alert tone="info">
          You are offline. This is the clinic list saved on this phone on {savedDate(saved.savedAt)}
          . Phone ahead to check the clinic is open.
        </Alert>
      )}
      {search.isError && !saved && (
        <Alert tone="error">
          {online
            ? search.error.message
            : 'You are offline and no clinic list has been saved on this phone yet. Phone your own vet, or try again when you have a connection.'}
        </Alert>
      )}
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
