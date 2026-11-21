import {
  AdvancedMarker,
  APIProvider,
  Circle,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Navigation } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import {
  directionsUrl,
  embedUrl,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  hasInteractiveMaps,
  SRI_LANKA_CENTER,
  type LatLng,
} from '../../lib/maps';
import './maps.css';

export interface MapPlace {
  id: string;
  position: LatLng;
  title: string;
  subtitle?: string;
  /** Internal link (e.g. the clinic page) shown in the info window. */
  href?: string;
  /** Emphasised pin, e.g. emergency clinics or urgent reports. */
  highlight?: boolean;
  /** Draw an area instead of an exact point (privacy for rescue reports). */
  approximateRadiusM?: number;
}

interface MapViewProps {
  places: MapPlace[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** The user's own location, shown as a blue dot. Never sent to the server. */
  userLocation?: LatLng | null;
  label: string;
  height?: number;
}

/** Fits the map around all places (and the user) whenever the list changes. */
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]!);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 48);
  }, [map, points]);
  return null;
}

function InteractiveMap({
  places,
  selectedId,
  onSelect,
  userLocation,
  label,
  height,
}: MapViewProps) {
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const points = useMemo(
    () => [...places.map((p) => p.position), ...(userLocation ? [userLocation] : [])],
    [places, userLocation],
  );

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="map-view" style={{ height }} role="region" aria-label={label}>
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={SRI_LANKA_CENTER}
          defaultZoom={7}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          streetViewControl={false}
          clickableIcons={false}
          onClick={() => onSelect?.(null)}
        >
          <FitBounds points={points} />
          {places.map((place) =>
            place.approximateRadiusM ? (
              <Circle
                key={place.id}
                center={place.position}
                radius={place.approximateRadiusM}
                strokeColor="#c2412d"
                strokeOpacity={0.8}
                strokeWeight={2}
                fillColor="#c2412d"
                fillOpacity={0.15}
                clickable
                onClick={() => onSelect?.(place.id)}
              />
            ) : (
              <AdvancedMarker
                key={place.id}
                position={place.position}
                title={place.title}
                onClick={() => onSelect?.(place.id)}
              >
                <Pin
                  background={place.highlight ? '#c2412d' : '#0a6c6c'}
                  borderColor={place.highlight ? '#8f2c1e' : '#064546'}
                  glyphColor="#ffffff"
                  scale={place.id === selectedId ? 1.25 : 1}
                />
              </AdvancedMarker>
            ),
          )}
          {userLocation && (
            <AdvancedMarker position={userLocation} title="Your location">
              <span className="map-user-dot" />
            </AdvancedMarker>
          )}
          {selected && (
            <InfoWindow
              position={selected.position}
              onCloseClick={() => onSelect?.(null)}
              headerContent={<strong>{selected.title}</strong>}
            >
              <div className="map-info">
                {selected.subtitle && <p>{selected.subtitle}</p>}
                <div className="map-info__links">
                  {selected.href && <Link to={selected.href}>Details</Link>}
                  {!selected.approximateRadiusM && (
                    <a href={directionsUrl(selected.position)} target="_blank" rel="noreferrer">
                      Directions
                    </a>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}

/** Without an API key: Google's keyless embed of the selected (or first) place. */
function EmbedMap({ places, selectedId, label, height }: MapViewProps) {
  const place = places.find((p) => p.id === selectedId) ?? places[0];
  if (!place) {
    return (
      <div className="map-view map-view--empty" style={{ height }}>
        <p>No locations to show on the map yet.</p>
      </div>
    );
  }
  return (
    <figure className="map-embed">
      <iframe
        title={`${label}: ${place.title}`}
        src={embedUrl(place.position, place.approximateRadiusM ? 14 : 15)}
        style={{ height }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <figcaption>
        <span>
          <strong>{place.title}</strong>
          {place.approximateRadiusM ? ' · approximate area' : ''}
        </span>
        {!place.approximateRadiusM && (
          <a href={directionsUrl(place.position)} target="_blank" rel="noreferrer">
            <Navigation size={14} aria-hidden="true" /> Directions
          </a>
        )}
        {place.href && (
          <Link to={place.href}>
            <ExternalLink size={14} aria-hidden="true" /> Details
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * Google map of places. With VITE_GOOGLE_MAPS_API_KEY it is interactive (all pins, info
 * windows, the user's location); without a key it shows one place at a time through Google's
 * keyless embed, and selecting a place in the list moves the map.
 */
export function MapView(props: MapViewProps) {
  const height = props.height ?? 420;
  return hasInteractiveMaps() ? (
    <InteractiveMap {...props} height={height} />
  ) : (
    <EmbedMap {...props} height={height} />
  );
}
