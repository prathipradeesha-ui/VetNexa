import { SEVERITY_LABELS, type WoundSeverity } from '@vetnexa/shared';
import { FlaskConical, Siren } from 'lucide-react';
import { Link } from 'react-router';

const severityTone: Record<WoundSeverity, string> = {
  MINOR: 'badge',
  MODERATE: 'badge badge--warning',
  SEVERE: 'badge badge--danger',
  UNCERTAIN: 'badge badge--info',
};

export function SeverityBadge({ severity }: { severity: WoundSeverity }) {
  return <span className={severityTone[severity]}>{SEVERITY_LABELS[severity]}</span>;
}

/** Signs that need a vet straight away, whatever a photo or the model suggests. */
export function EmergencyNotice() {
  return (
    <div className="emergency-notice" role="note">
      <Siren size={20} aria-hidden="true" />
      <p>
        <strong>Emergency?</strong> If your pet is bleeding heavily, struggling to breathe, has
        collapsed or was hit by a vehicle, do not wait for an assessment.{' '}
        <Link to="/clinics?emergency=true">Find an emergency clinic now</Link>.
      </p>
    </div>
  );
}

/** Shown whenever the result came from a model trained on synthetic images, not real wounds. */
export function DemoModelNotice() {
  return (
    <div className="demo-notice" role="note">
      <FlaskConical size={20} aria-hidden="true" />
      <p>
        <strong>Demonstration model.</strong> The model running now was trained on computer-drawn
        test images, not real wound photos, so this result says nothing about your pet. It shows how
        the feature works while real veterinary data is being collected.
      </p>
    </div>
  );
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "21 Nov 2026, 14:05" in the viewer's time zone. */
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

export const percent = (value: number) => `${Math.round(value * 100)}%`;
