import { WOUND_CLASS_LABELS } from '@vetnexa/shared';
import { ArrowLeft, CalendarPlus, MapPin, ShieldAlert, Stethoscope, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import {
  DemoModelNotice,
  EmergencyNotice,
  formatDateTime,
  percent,
  SeverityBadge,
} from './AssessmentBits';
import { SymptomEvidencePanel } from './SymptomEvidencePanel';
import { useAssessment, useDeleteAssessment } from './useAssessments';
import '../pets/pets.css';
import './assessments.css';

/** How each severity is explained to the owner, in plain words. */
const SEVERITY_MEANING = {
  MINOR: 'Usually manageable at home with care. Watch it closely over the next few days.',
  MODERATE: 'Should be seen by a veterinarian, ideally within 24 hours.',
  SEVERE: 'Needs veterinary attention as soon as possible.',
  UNCERTAIN: 'The photo could not be assessed confidently. Please ask a veterinarian.',
} as const;

export function AssessmentResultPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const assessment = useAssessment(id);
  const remove = useDeleteAssessment();
  const [confirming, setConfirming] = useState(false);

  if (assessment.isPending) return <PageLoader label="Loading result…" />;
  if (assessment.isError) {
    return (
      <>
        <Link to="/dashboard/assessments" className="back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </Link>
        <Alert tone="error">{assessment.error.message}</Alert>
      </>
    );
  }

  const result = assessment.data;
  const uncertain = result.status === 'UNCERTAIN';
  const ranked = Object.entries(result.probabilities).sort(([, a], [, b]) => b - a);

  return (
    <>
      <Link to="/dashboard/assessments" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <div className="page-header">
        <div>
          <h1>Wound check for {result.pet.name}</h1>
          <p>{formatDateTime(result.createdAt)}</p>
        </div>
      </div>

      {result.demoModel && <DemoModelNotice />}

      <div className="assessment-result">
        <img
          src={result.imageUrl}
          alt={`Wound photo of ${result.pet.name}`}
          className="assessment-result__photo"
        />

        <section
          className={`card assessment-verdict assessment-verdict--${result.severity.toLowerCase()}`}
          aria-labelledby="verdict-title"
        >
          <div className="assessment-verdict__head">
            <h2 id="verdict-title">{result.summary}</h2>
            <SeverityBadge severity={result.severity} />
          </div>
          <p className="assessment-verdict__meaning">{SEVERITY_MEANING[result.severity]}</p>

          {!uncertain && (
            <div className="result-confidence">
              <div className="result-confidence__label">
                <span>Model confidence</span>
                <strong>{percent(result.confidence)}</strong>
              </div>
              <div
                className="result-confidence__bar"
                role="meter"
                aria-label="Model confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(result.confidence * 100)}
              >
                <span style={{ width: percent(result.confidence) }} />
              </div>
              <p className="field__hint">
                Confidence is how sure the model is, not a measure of how serious the wound is.
              </p>
            </div>
          )}

          {result.escalated && (
            <Alert tone="warning">
              {result.symptoms &&
              (result.symptoms.redFlags.length > 0 || result.symptoms.level !== 'routine')
                ? 'The urgency was raised to be on the safe side, based on the symptoms you described or other signs the model saw.'
                : 'The urgency was raised because the model also saw signs of a more serious problem.'}
            </Alert>
          )}

          <h3 className="assessment-verdict__subtitle">What to do now</h3>
          <p>{result.guidance}</p>

          {result.referToVet ? (
            <div className="refer-box">
              <Stethoscope size={20} aria-hidden="true" />
              <div>
                <strong>We recommend a veterinarian sees this wound.</strong>
                <div className="refer-box__actions">
                  <Link to="/clinics" className="btn btn--primary btn--sm">
                    <MapPin size={16} aria-hidden="true" /> Find a clinic
                  </Link>
                  <Link
                    to={`/dashboard/consultations/new?petId=${result.pet.id}`}
                    className="btn btn--secondary btn--sm"
                  >
                    <CalendarPlus size={16} aria-hidden="true" /> Book a consultation
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <p className="field__hint">
              If the wound gets worse, smells, swells or your pet seems unwell, see a vet.
            </p>
          )}
        </section>
      </div>

      <SymptomEvidencePanel answers={result.answers} symptoms={result.symptoms} />

      <EmergencyNotice />

      <details className="card model-details">
        <summary>What the model saw</summary>
        <p className="field__hint">
          Probability the model gave to each wound type. These numbers come from a research
          prototype and can be wrong.
        </p>
        <ul className="probability-list">
          {ranked.map(([name, value]) => (
            <li key={name}>
              <span>{WOUND_CLASS_LABELS[name] ?? name}</span>
              <span className="probability-list__bar" aria-hidden="true">
                <span style={{ width: percent(value) }} />
              </span>
              <strong>{percent(value)}</strong>
            </li>
          ))}
        </ul>
        <p className="field__hint">Model version {result.modelVersion}</p>
      </details>

      {result.ownerNotes && (
        <section className="card">
          <h2 className="card-title">Your notes</h2>
          <p className="pre-line">{result.ownerNotes}</p>
        </section>
      )}

      <p className="assessment-disclaimer">
        <ShieldAlert size={16} aria-hidden="true" /> {result.disclaimer}
      </p>

      <div className="assessment-delete">
        {!confirming ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete this result
          </Button>
        ) : (
          <div className="danger-zone__confirm">
            <span>Delete this result and its photo? This cannot be undone.</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              size="sm"
              className="btn--danger"
              loading={remove.isPending}
              loadingText="Deleting…"
              onClick={() =>
                remove.mutate(result.id, {
                  onSuccess: () => navigate('/dashboard/assessments', { replace: true }),
                })
              }
            >
              Delete
            </Button>
          </div>
        )}
        {remove.isError && <Alert tone="error">{remove.error.message}</Alert>}
      </div>
    </>
  );
}
