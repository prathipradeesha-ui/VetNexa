import {
  FOLLOW_UP_ADVICE,
  FOLLOW_UP_DAYS,
  FOLLOW_UP_PROGRESS,
  FOLLOW_UP_PROGRESS_LABELS,
  type FollowUpProgress,
  type WoundAssessmentResult,
  type WoundFollowUp,
} from '@vetnexa/shared';
import { CalendarCheck, Camera, MapPin, Stethoscope } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FieldWrapper } from '../../components/ui/FormField';
import { formatDateTime } from './AssessmentBits';
import { useCancelFollowUp, useCompleteFollowUp, useCreateFollowUp } from './useAssessments';

const DAY_LABELS: Record<number, string> = {
  1: 'Tomorrow',
  2: 'In 2 days',
  3: 'In 3 days',
  7: 'In 1 week',
};

const PROGRESS_TONE: Record<FollowUpProgress, string> = {
  BETTER: 'badge',
  SAME: 'badge badge--warning',
  WORSE: 'badge badge--danger',
};

/** Calendar days from today until a date and time (negative once it has passed). */
export function daysUntilDate(iso: string, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(iso);
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function followUpDueLabel(iso: string) {
  const days = daysUntilDate(iso);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

/** The answer and advice shown after the owner records how the wound looks. */
export function FollowUpAdvice({ followUp }: { followUp: WoundFollowUp }) {
  if (!followUp.progress) return null;
  if (followUp.progress === 'WORSE') {
    return (
      <Alert tone="warning" title="Please see a vet">
        <p>{FOLLOW_UP_ADVICE.WORSE}</p>
        <div className="follow-up__actions">
          <Link to="/clinics" className="btn btn--primary btn--sm">
            <MapPin size={16} aria-hidden="true" /> Find a clinic
          </Link>
          <Link
            to={`/dashboard/consultations/new?petId=${followUp.pet.id}`}
            className="btn btn--secondary btn--sm"
          >
            <Stethoscope size={16} aria-hidden="true" /> Book a consultation
          </Link>
        </div>
      </Alert>
    );
  }
  return (
    <Alert tone={followUp.progress === 'BETTER' ? 'success' : 'info'}>
      {FOLLOW_UP_ADVICE[followUp.progress]}
    </Alert>
  );
}

function AnswerForm({
  result,
  followUp,
}: {
  result: WoundAssessmentResult;
  followUp: WoundFollowUp;
}) {
  const complete = useCompleteFollowUp(result.id);
  const cancel = useCancelFollowUp(result.id);
  const [progress, setProgress] = useState<FollowUpProgress | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const overdue = daysUntilDate(followUp.dueAt) < 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!progress) {
      setError('Please choose how the wound looks now');
      return;
    }
    setError('');
    complete.mutate({ id: followUp.id, progress, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="follow-up__due">
        <span>Next check</span>
        <strong>{formatDateTime(followUp.dueAt)}</strong>
        <span className={overdue ? 'badge badge--danger' : 'badge badge--warning'}>
          {followUpDueLabel(followUp.dueAt)}
        </span>
      </p>
      <p className="field__hint">
        You can answer now if the wound changes before then. If it looks worse at any time, do not
        wait for the follow-up.
      </p>

      <fieldset
        className="follow-up__choices"
        aria-describedby={error ? 'follow-up-error' : undefined}
      >
        <legend>How does the wound look now?</legend>
        {FOLLOW_UP_PROGRESS.map((value) => (
          <label
            key={value}
            className={`follow-up__choice follow-up__choice--${value.toLowerCase()}`}
          >
            <input
              type="radio"
              name="follow-up-progress"
              value={value}
              checked={progress === value}
              onChange={() => setProgress(value)}
            />
            <span>{FOLLOW_UP_PROGRESS_LABELS[value]}</span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p id="follow-up-error" className="field__error">
          {error}
        </p>
      )}

      <FieldWrapper id="follow-up-note" label="Anything you noticed?" optional>
        <textarea
          id="follow-up-note"
          className="textarea"
          rows={2}
          maxLength={500}
          value={note}
          placeholder="e.g. less red, still licking it, a little swelling"
          onChange={(event) => setNote(event.target.value)}
        />
      </FieldWrapper>

      {complete.isError && <Alert tone="error">{complete.error.message}</Alert>}
      {cancel.isError && <Alert tone="error">{cancel.error.message}</Alert>}

      <div className="follow-up__actions">
        <Button type="submit" loading={complete.isPending} loadingText="Saving…">
          Save how it looks
        </Button>
        <Link
          to={`/dashboard/assessments/new?petId=${result.pet.id}`}
          className="btn btn--secondary"
        >
          <Camera size={18} aria-hidden="true" /> Check a new photo
        </Link>
        <Button
          variant="ghost"
          size="sm"
          loading={cancel.isPending}
          onClick={() => cancel.mutate(followUp.id)}
        >
          Cancel follow-up
        </Button>
      </div>
    </form>
  );
}

function PlanForm({ result }: { result: WoundAssessmentResult }) {
  const create = useCreateFollowUp(result.id);
  return (
    <div>
      <p>
        Wounds can change quickly. Choose when to look at it again; the reminder shows on your
        dashboard in the web app and the mobile app.
      </p>
      <div className="follow-up__days" role="group" aria-label="Look again">
        {FOLLOW_UP_DAYS.map((days) => (
          <Button
            key={days}
            variant="secondary"
            size="sm"
            disabled={create.isPending}
            onClick={() => create.mutate(days)}
          >
            {DAY_LABELS[days]}
          </Button>
        ))}
      </div>
      {create.isError && <Alert tone="error">{create.error.message}</Alert>}
    </div>
  );
}

/** Follow-up check-ins on a saved wound check: plan one, answer it, and see earlier answers. */
export function FollowUpCard({ result }: { result: WoundAssessmentResult }) {
  const followUps = result.followUps ?? [];
  const open = followUps.find((f) => !f.completedAt);
  const done = followUps
    .filter((f) => f.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));

  return (
    <section className="card follow-up" aria-labelledby="follow-up-title">
      <h2 id="follow-up-title" className="card-title">
        <CalendarCheck size={20} aria-hidden="true" /> Follow-up check
      </h2>

      {done[0] && <FollowUpAdvice followUp={done[0]} />}

      {open ? <AnswerForm result={result} followUp={open} /> : <PlanForm result={result} />}

      {done.length > 0 && (
        <>
          <h3 className="evidence-subtitle">Earlier check-ins</h3>
          <ul className="follow-up__history">
            {done.map((f) => (
              <li key={f.id}>
                <span className={PROGRESS_TONE[f.progress!]}>
                  {FOLLOW_UP_PROGRESS_LABELS[f.progress!]}
                </span>
                <span className="follow-up__when">{formatDateTime(f.completedAt!)}</span>
                {f.note && <span className="follow-up__note">{f.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
