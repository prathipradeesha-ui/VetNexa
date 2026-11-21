import {
  TRIAGE_OUTCOME_LABELS,
  WOUND_CLASS_LABELS,
  type TriageDetails,
  type TriageInput,
  type TriageOutcome,
} from '@vetnexa/shared';
import { Camera, ClipboardList, Scale, ShieldCheck } from 'lucide-react';
import { percent } from './AssessmentBits';

const SHORT_LABELS: Record<TriageOutcome, string> = {
  ROUTINE: 'Routine care',
  CONSULT: 'See a vet',
  URGENT: 'Urgent',
  UNABLE: 'Unable to assess',
};
const TONE: Record<TriageOutcome, string> = {
  ROUTINE: 'badge',
  CONSULT: 'badge badge--warning',
  URGENT: 'badge badge--danger',
  UNABLE: 'badge badge--info',
};

export function TriageBadge({ outcome }: { outcome: TriageOutcome }) {
  return <span className={TONE[outcome]}>{SHORT_LABELS[outcome]}</span>;
}

/** What each outcome means for the owner, in plain words. */
export const OUTCOME_MEANING: Record<TriageOutcome, string> = {
  ROUTINE: 'Usually manageable at home with care. Watch it closely over the next few days.',
  CONSULT: 'Should be seen by a veterinarian, ideally within 24 hours.',
  URGENT: 'Needs veterinary attention as soon as possible.',
  UNABLE:
    'There was not enough reliable information to assess this safely. Please ask a veterinarian.',
};

const LEVEL_LABEL = { ROUTINE: 'routine care', CONSULT: 'a vet visit', URGENT: 'urgent care' };

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="triage-meter">
      <span>{label}</span>
      <span
        className="triage-meter__bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        <span style={{ width: percent(value) }} />
      </span>
      <strong>{percent(value)}</strong>
    </div>
  );
}

function InputCard({ input }: { input: TriageInput }) {
  const isImage = input.source === 'image';
  const Icon = isImage ? Camera : ClipboardList;
  return (
    <li className="triage-input">
      <h4>
        <Icon size={18} aria-hidden="true" /> {isImage ? 'Your photo' : 'Your answers'}
        <span className="triage-input__weight">counted for {percent(input.weight)}</span>
      </h4>
      <p className="triage-input__says">
        {isImage && input.topClass
          ? `Looks most like ${WOUND_CLASS_LABELS[input.topClass]?.toLowerCase() ?? input.topClass}; suggests ${LEVEL_LABEL[input.level]}.`
          : `Suggest ${LEVEL_LABEL[input.level]}.`}
      </p>
      <Meter label="Risk" value={input.risk} />
      <Meter label="Reliability" value={input.reliability} />
      {isImage && (
        <p className="field__hint">
          Reliability combines photo quality
          {input.quality != null && ` (${percent(input.quality)})`}, how familiar the photo looks to
          the model
          {input.familiarity != null && ` (${percent(input.familiarity)})`} and how sure it is
          {input.certainty != null && ` (${percent(input.certainty)})`}.
        </p>
      )}
      {input.notes.map((note) => (
        <p key={note} className="triage-input__note">
          {note}
        </p>
      ))}
    </li>
  );
}

/**
 * "Why this result": each piece of evidence with its risk, its reliability and how much it
 * counted in the reliability-weighted fusion, plus any safety overrides.
 */
export function TriageExplanation({ details }: { details: TriageDetails | null }) {
  return (
    <section className="card triage-explanation" aria-labelledby="triage-why-title">
      <h2 id="triage-why-title" className="card-title">
        <Scale size={20} aria-hidden="true" /> Why this result
      </h2>
      {!details ? (
        <p className="field__hint">
          This result was made before VetNexa combined photos and answers, so no breakdown is
          available.
        </p>
      ) : (
        <>
          <p>
            VetNexa weighs each piece of evidence by how reliable it is.
            {details.combinedRisk !== null && (
              <>
                {' '}
                Combined risk: <strong>{percent(details.combinedRisk)}</strong>.
              </>
            )}{' '}
            Overall reliability: <strong>{percent(details.reliability)}</strong>.
          </p>
          <ul className="triage-inputs">
            {details.inputs.map((input) => (
              <InputCard key={input.source} input={input} />
            ))}
          </ul>
          {details.overrides.length > 0 && (
            <div className="triage-overrides">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Safety rules applied</strong>
                <ul>
                  {details.overrides.map((override) => (
                    <li key={override}>{override}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="field__hint">
            Outcome: {TRIAGE_OUTCOME_LABELS[details.outcome]}. Missing a serious problem is treated
            as worse than an unnecessary vet visit, so the rules lean towards caution.
          </p>
        </>
      )}
    </section>
  );
}
