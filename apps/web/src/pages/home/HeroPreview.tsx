import { AlertTriangle, CalendarClock, Dog, MapPin, Syringe } from 'lucide-react';

/**
 * A static preview of the product shown in the hero: a pet profile, an upcoming
 * vaccination and an AI assessment result. It uses the same components and styles as
 * the real dashboard, so it reflects what users actually get. Hidden from screen
 * readers because it is illustrative.
 */
export function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="preview-card preview-card--pet">
        <div className="preview-pet">
          <span className="preview-pet__avatar">
            <Dog size={28} />
          </span>
          <div>
            <strong>Bruno</strong>
            <span>Labrador Retriever · 4 yrs · 31.4 kg</span>
          </div>
          <span className="badge">Healthy</span>
        </div>
        <ul className="preview-records">
          <li>
            <Syringe size={16} />
            <span>DHPPi booster</span>
            <span className="badge badge--warning">Due in 25 days</span>
          </li>
          <li>
            <CalendarClock size={16} />
            <span>Check-up with Dr. Ruwan</span>
            <span className="badge badge--neutral">Thu, 4.00 pm</span>
          </li>
        </ul>
      </div>

      <div className="preview-card preview-card--ai">
        <div className="preview-ai__header">
          <span className="preview-ai__label">AI wound assessment</span>
          <span className="badge badge--warning">
            <AlertTriangle size={12} /> Moderate
          </span>
        </div>
        <p className="preview-ai__result">Likely a laceration (cut)</p>
        <div className="confidence">
          <div className="confidence__bar">
            <span style={{ width: '81%' }} />
          </div>
          <span className="confidence__value">81% confident</span>
        </div>
        <p className="preview-ai__advice">
          Clean gently with saline and see a vet within 24 hours.
        </p>
        <span className="preview-ai__clinic">
          <MapPin size={14} /> 3 clinics open near Colombo
        </span>
      </div>
    </div>
  );
}
