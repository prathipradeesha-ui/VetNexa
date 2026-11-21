import { RED_FLAGS, type RedFlagId } from '@vetnexa/shared';
import { AlertTriangle, Phone, Stethoscope } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import '../assessments/assessments.css';

export type DangerResult = 'go-now' | 'see-vet';

/**
 * The same rule the online wound check uses for red flags: any one danger sign means urgent
 * veterinary attention. With no danger signs the answer is still "see a vet soon", never "it
 * is fine", because without a photo and the full questions the wound cannot be judged.
 */
export function dangerResult(signs: readonly RedFlagId[]): DangerResult {
  return signs.length > 0 ? 'go-now' : 'see-vet';
}

/** Danger-sign check that runs on the phone, for when the photo check cannot be used. */
export function DangerSignCheck() {
  const [signs, setSigns] = useState<RedFlagId[]>([]);
  const [result, setResult] = useState<DangerResult | null>(null);

  const toggle = (id: RedFlagId) => {
    setResult(null);
    setSigns((current) =>
      current.includes(id) ? current.filter((sign) => sign !== id) : [...current, id],
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setResult(dangerResult(signs));
  };

  return (
    <form className="danger-check" onSubmit={onSubmit}>
      <fieldset className="question">
        <legend className="question__legend">Is any of these happening right now?</legend>
        <p className="field__hint">Tick everything that applies. Leave all unticked if none do.</p>
        <div className="option-grid">
          {RED_FLAGS.map((flag) => (
            <label key={flag.id} className="option option--flag">
              <input
                type="checkbox"
                checked={signs.includes(flag.id)}
                onChange={() => toggle(flag.id)}
              />
              <span>{flag.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="secondary">
        Check danger signs
      </Button>

      <div aria-live="polite">
        {result === 'go-now' && (
          <div className="danger-check__result danger-check__result--urgent">
            <AlertTriangle size={24} aria-hidden="true" />
            <div>
              <h3>Go to a veterinarian now</h3>
              <p>
                {signs.length === 1 ? 'This is a danger sign' : 'These are danger signs'} that need
                urgent treatment. Phone an emergency clinic on the way so they can get ready.
              </p>
              <a href="#emergency-clinics-title" className="btn btn--primary btn--sm">
                <Phone size={16} aria-hidden="true" /> Emergency clinics
              </a>
            </div>
          </div>
        )}
        {result === 'see-vet' && (
          <div className="danger-check__result">
            <Stethoscope size={24} aria-hidden="true" />
            <div>
              <h3>No danger signs, but a vet should still check it</h3>
              <p>
                Without a photo we cannot judge how serious the wound is. Bites, punctures and deep
                cuts often hide damage under the skin, so phone a vet for advice today, and use the
                photo check when you are back online.
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
