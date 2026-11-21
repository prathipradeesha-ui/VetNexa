import { useCallback, useState } from 'react';

/** Google Maps settings from the build environment (see apps/web/.env.example). */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';
export const hasInteractiveMaps = () => GOOGLE_MAPS_API_KEY.length > 0;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Centre of Sri Lanka, used before any location is known. */
export const SRI_LANKA_CENTER: LatLng = { lat: 7.8731, lng: 80.7718 };

/** Great-circle distance in kilometres (haversine formula). */
export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number) {
  return km < 1
    ? `${Math.round(km * 1000)} m away`
    : `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/** Google Maps directions to a place (opens the Maps app on phones). */
export function directionsUrl(to: LatLng | string) {
  const destination = typeof to === 'string' ? to : `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Google Maps page for a place. */
export function placeUrl(at: LatLng | string) {
  const query = typeof at === 'string' ? at : `${at.lat},${at.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Keyless Google Maps embed of one place, used when no API key is configured. */
export function embedUrl(at: LatLng | string, zoom = 15) {
  const query = typeof at === 'string' ? at : `${at.lat},${at.lng}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; position: LatLng }
  | { status: 'error'; message: string };

/**
 * Asks the browser for the user's location only when they press a button. The position stays
 * in the browser: it is used to sort and measure distances and is never sent to the server.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Your browser cannot share your location.' });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: 'ready',
          position: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      (error) =>
        setState({
          status: 'error',
          message:
            error.code === error.PERMISSION_DENIED
              ? 'Location permission was declined. You can still search by town.'
              : 'Your location could not be found. You can still search by town.',
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return { state, locate };
}
