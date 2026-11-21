import { Crosshair, X } from 'lucide-react';
import { useEffect } from 'react';
import { useGeolocation, type LatLng } from '../../lib/maps';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { MapView } from './MapView';

interface LocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  /** Explains who will see the position. */
  privacyNote: string;
}

/**
 * "Use my current location" for forms. The browser asks the user first; the position is only
 * attached when they press the button, and they can remove it again.
 */
export function LocationPicker({ value, onChange, privacyNote }: LocationPickerProps) {
  const geo = useGeolocation();

  useEffect(() => {
    if (geo.state.status === 'ready') onChange(geo.state.position);
    // Only react to a new position, not to onChange identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.state]);

  return (
    <div className="location-picker">
      {!value ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={geo.locate}
          loading={geo.state.status === 'locating'}
          loadingText="Finding your location…"
        >
          <Crosshair size={16} aria-hidden="true" /> Use my current location
        </Button>
      ) : (
        <>
          <MapView
            label="Location you are sharing"
            places={[{ id: 'here', position: value, title: 'Location you are sharing' }]}
            selectedId="here"
            height={200}
          />
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X size={16} aria-hidden="true" /> Remove location
          </Button>
        </>
      )}
      {geo.state.status === 'error' && <Alert tone="info">{geo.state.message}</Alert>}
      <p className="field__hint">{privacyNote}</p>
    </div>
  );
}
