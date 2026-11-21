import { TRIAGE_OUTCOME_LABELS, type GuestAssessmentResult } from '@vetnexa/shared';
import { Camera, ImageUp, MapPin, ScanSearch, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { DemoModelNotice, percent } from '../assessments/AssessmentBits';
import { SymptomEvidencePanel } from '../assessments/SymptomEvidencePanel';
import { OUTCOME_MEANING, TriageBadge, TriageExplanation } from '../assessments/TriageExplanation';
import {
  emptyAnswers,
  RedFlagQuestions,
  SymptomQuestionList,
  toPayload,
  type DraftAnswers,
} from '../assessments/SymptomQuestions';
import { photoQualityProblems } from '../assessments/useAssessments';
import { useCurrentUser } from '../auth/useAuth';
import { useEmergencyStatus, useGuestAssessment } from './useEmergency';
import '../assessments/assessments.css';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

function GuestResult({ result, onAgain }: { result: GuestAssessmentResult; onAgain: () => void }) {
  const { data: user } = useCurrentUser();
  return (
    <div className="guest-result" aria-live="polite">
      {result.demoModel && <DemoModelNotice />}
      <div
        className={`card assessment-verdict assessment-verdict--${result.severity.toLowerCase()}`}
      >
        <p className="triage-outcome">{TRIAGE_OUTCOME_LABELS[result.triage]}</p>
        <div className="assessment-verdict__head">
          <h3>{result.summary}</h3>
          <TriageBadge outcome={result.triage} />
        </div>
        <p className="assessment-verdict__meaning">{OUTCOME_MEANING[result.triage]}</p>
        {result.status === 'ASSESSED' && (
          <p className="field__hint">Photo model confidence: {percent(result.confidence)}</p>
        )}
        <h4 className="assessment-verdict__subtitle">What to do now</h4>
        <p>{result.guidance}</p>
        {result.referToVet && (
          <div className="refer-box">
            <MapPin size={20} aria-hidden="true" />
            <div>
              <strong>We recommend a veterinarian sees this.</strong>
              <div className="refer-box__actions">
                <a href="#emergency-clinics-title" className="btn btn--primary btn--sm">
                  Nearest emergency clinics
                </a>
                <Link to="/clinics" className="btn btn--secondary btn--sm">
                  All clinics
                </Link>
              </div>
            </div>
          </div>
        )}
        <p className="chat-disclaimer">{result.disclaimer}</p>
      </div>
      <TriageExplanation details={result.triageDetails} />
      <SymptomEvidencePanel answers={result.answers} symptoms={result.symptoms} />
      <div className="guest-result__after">
        <p>
          This result was <strong>not saved</strong>, and your photo was not stored.
        </p>
        <div className="guest-result__buttons">
          <Button variant="secondary" onClick={onAgain}>
            <ScanSearch size={18} aria-hidden="true" /> Check another photo
          </Button>
          {!user && (
            <Link to="/register" className="btn btn--primary">
              <UserPlus size={18} aria-hidden="true" /> Create a free account to save checks
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Wound check for emergencies, without an account: choose dog or cat, tick any urgent signs,
 * optionally answer the symptom questions, then take or upload a photo.
 */
export function GuestWoundCheck() {
  const status = useEmergencyStatus();
  const check = useGuestAssessment();
  const fileInput = useRef<HTMLInputElement>(null);
  const [species, setSpecies] = useState<'DOG' | 'CAT' | ''>('');
  const [answers, setAnswers] = useState<DraftAnswers>(emptyAnswers);
  const [photo, setPhoto] = useState<File | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type))
      return setErrors({ photo: 'Please choose a JPG, PNG or WebP image.' });
    if (file.size > MAX_MB * 1024 * 1024)
      return setErrors({ photo: `Photos must be ${MAX_MB} MB or smaller.` });
    check.reset();
    setErrors({});
    setPhoto(file);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!species) next.species = 'Please choose dog or cat';
    if (!photo) next.photo = 'Please take or choose a photo';
    if (!understood) next.understood = 'Please confirm you understand this is not a diagnosis';
    setErrors(next);
    if (Object.keys(next).length > 0 || !photo || !species) return;
    check.mutate({ species, photo, answers: toPayload(answers) });
  };

  const reset = () => {
    check.reset();
    setPhoto(null);
    setAnswers(emptyAnswers());
    setUnderstood(false);
  };

  if (check.isSuccess) return <GuestResult result={check.data} onAgain={reset} />;

  const qualityProblems = photoQualityProblems(check.error);
  const unavailable = status.isSuccess && !status.data.available;

  return (
    <form className="guest-check" noValidate onSubmit={onSubmit}>
      {status.data?.available && status.data.demoModel && <DemoModelNotice />}
      {unavailable && (
        <Alert tone="info" title="The wound check is not available right now">
          If you are worried, call an emergency clinic below.
        </Alert>
      )}

      <fieldset className="question">
        <legend className="question__legend">Is it a dog or a cat?</legend>
        <div className="option-grid option-grid--two">
          {(['DOG', 'CAT'] as const).map((value) => (
            <label key={value} className="option">
              <input
                type="radio"
                name="guest-species"
                checked={species === value}
                onChange={() => setSpecies(value)}
              />
              <span>{value === 'DOG' ? 'Dog' : 'Cat'}</span>
            </label>
          ))}
        </div>
        {errors.species && <span className="field__error">{errors.species}</span>}
      </fieldset>

      <RedFlagQuestions value={answers} onChange={setAnswers} />

      <details className="guest-check__symptoms">
        <summary>Answer symptom questions (recommended, about 1 minute)</summary>
        <SymptomQuestionList value={answers} onChange={setAnswers} />
      </details>

      <div className="field">
        <label htmlFor="guest-photo" className="field__label">
          Photo of the wound or skin
        </label>
        <input
          ref={fileInput}
          id="guest-photo"
          type="file"
          accept={TYPES.join(',')}
          capture="environment"
          className="sr-only"
          onChange={onPhoto}
        />
        <button
          type="button"
          className={`photo-drop${preview ? ' photo-drop--filled' : ''}`}
          onClick={() => fileInput.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Chosen photo" />
          ) : (
            <span className="photo-drop__empty">
              <Camera size={28} aria-hidden="true" />
              Take a photo or choose one
            </span>
          )}
        </button>
        {preview && (
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <ImageUp size={16} aria-hidden="true" /> Change photo
          </Button>
        )}
        {errors.photo && <span className="field__error">{errors.photo}</span>}
      </div>

      {qualityProblems && (
        <Alert tone="warning" title="This photo cannot be assessed reliably">
          <ul className="quality-problems">
            {qualityProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}
      {check.isError && !qualityProblems && <Alert tone="error">{check.error.message}</Alert>}

      <div className="field">
        <label className="pet-form__checkbox">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
          />
          I understand this is a preliminary AI check, not a diagnosis, and that it does not replace
          a veterinarian.
        </label>
        {errors.understood && <span className="field__error">{errors.understood}</span>}
      </div>

      <Button
        type="submit"
        loading={check.isPending}
        loadingText="Checking…"
        disabled={unavailable}
      >
        Check wound now
      </Button>
      <p className="field__hint">No account needed. The photo and result are not stored.</p>
    </form>
  );
}
