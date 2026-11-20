import { Star } from 'lucide-react';
import { useId } from 'react';

/** Read-only star rating, e.g. 4.5 shows four full stars and one half star. */
export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((position) => {
        const fill = Math.max(0, Math.min(1, value - (position - 1)));
        return (
          <span key={position} className="stars__star" style={{ width: size, height: size }}>
            <Star size={size} className="stars__empty" aria-hidden="true" />
            <span className="stars__fill" style={{ width: `${fill * 100}%` }}>
              <Star size={size} aria-hidden="true" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

interface StarInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  error?: string;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * Star picker built from radio buttons, so it works with the keyboard (arrow keys)
 * and screen readers announce "4 stars, Very good".
 */
export function StarInput({ value, onChange, error }: StarInputProps) {
  const name = useId();
  return (
    <fieldset className="star-input" aria-invalid={error ? true : undefined}>
      <legend className="field__label">Your rating</legend>
      <div className="star-input__options">
        {[1, 2, 3, 4, 5].map((stars) => (
          <label key={stars} className="star-input__option" title={LABELS[stars]}>
            <input
              type="radio"
              name={name}
              value={stars}
              checked={value === stars}
              onChange={() => onChange(stars)}
              aria-label={`${stars} star${stars === 1 ? '' : 's'}, ${LABELS[stars]}`}
            />
            <Star
              size={28}
              aria-hidden="true"
              className={value !== undefined && stars <= value ? 'is-filled' : ''}
            />
          </label>
        ))}
        {value ? <span className="star-input__label">{LABELS[value]}</span> : null}
      </div>
      {error && <span className="field__error">{error}</span>}
    </fieldset>
  );
}
