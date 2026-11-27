import type { SkinCheck } from '@vetnexa/shared';
import { Microscope } from 'lucide-react';
import { percent } from './AssessmentBits';

const SKIN_LABELS: Record<string, string> = {
  healthy: 'Healthy skin',
  ringworm: 'Ringworm',
  mange: 'Mange or scabies',
  fungal_infection: 'Other fungal infection',
  dermatitis: 'Dermatitis or allergy',
};

const STATUS_TEXT = {
  SUGGESTED: 'Closest match',
  UNSURE: 'Not sure',
  UNFAMILIAR: 'No suggestion',
} as const;

/**
 * Advisory skin-condition suggestion from the second model. It is shown below the triage and
 * never changes it. Hidden when no skin check was made (older results, no model, poor photo).
 */
export function SkinCheckPanel({ skinCheck }: { skinCheck: SkinCheck | null }) {
  if (!skinCheck) return null;
  const ranked = Object.entries(skinCheck.probabilities).sort(([, a], [, b]) => b - a);

  return (
    <section className="card skin-check" aria-labelledby="skin-check-title">
      <h2 id="skin-check-title" className="card-title">
        <Microscope size={20} aria-hidden="true" /> Skin check
        <span className="badge badge--neutral">Advisory</span>
      </h2>
      <p className="skin-check__status">
        <span>{STATUS_TEXT[skinCheck.status]}</span>
        {skinCheck.status === 'SUGGESTED' && (
          <strong>
            {skinCheck.label}
            {skinCheck.confidence !== null && ` (${percent(skinCheck.confidence)})`}
          </strong>
        )}
      </p>
      <p>{skinCheck.advice}</p>
      <p className="field__hint">
        This is a second check for common skin conditions. It does not change the advice above and
        is not a diagnosis. Only a vet can confirm a skin condition, often with a skin scrape or
        test.
      </p>
      {skinCheck.status !== 'UNFAMILIAR' && (
        <details className="skin-check__details">
          <summary>How close each condition was</summary>
          <ul className="probability-list">
            {ranked.map(([name, value]) => (
              <li key={name}>
                <span>{SKIN_LABELS[name] ?? name}</span>
                <span className="probability-list__bar" aria-hidden="true">
                  <span style={{ width: percent(value) }} />
                </span>
                <strong>{percent(value)}</strong>
              </li>
            ))}
          </ul>
          <p className="field__hint">Model version {skinCheck.modelVersion}</p>
        </details>
      )}
    </section>
  );
}
