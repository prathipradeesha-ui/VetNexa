import { RED_FLAGS, SYMPTOM_QUESTIONS, type RedFlagId } from '@vetnexa/shared';
import { Siren } from 'lucide-react';
import { Link } from 'react-router';

/** Answers while the form is being filled in. `null` means "Not sure". */
export interface DraftAnswers {
  redFlags: RedFlagId[];
  single: Record<string, string | null>;
  signs: string[];
  signsUnsure: boolean;
}

export const emptyAnswers = (): DraftAnswers => ({
  redFlags: [],
  single: Object.fromEntries(
    SYMPTOM_QUESTIONS.filter((q) => q.type === 'single').map((q) => [q.id, null]),
  ),
  signs: [],
  signsUnsure: false,
});

/** The payload sent to the API (see symptomAnswersSchema in @vetnexa/shared). */
export function toPayload(draft: DraftAnswers) {
  return {
    redFlags: draft.redFlags,
    ...draft.single,
    signs: draft.signsUnsure ? null : draft.signs,
  };
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export function RedFlagQuestions({
  value,
  onChange,
}: {
  value: DraftAnswers;
  onChange: (next: DraftAnswers) => void;
}) {
  return (
    <fieldset className="question">
      <legend className="question__legend">Is any of these happening right now?</legend>
      <p className="field__hint">Tick everything that applies. Leave all unticked if none do.</p>
      <div className="option-grid">
        {RED_FLAGS.map((flag) => (
          <label key={flag.id} className="option option--flag">
            <input
              type="checkbox"
              checked={value.redFlags.includes(flag.id)}
              onChange={() => onChange({ ...value, redFlags: toggle(value.redFlags, flag.id) })}
            />
            <span>{flag.label}</span>
          </label>
        ))}
      </div>
      {value.redFlags.length > 0 && (
        <div className="red-flag-alert" role="alert">
          <Siren size={22} aria-hidden="true" />
          <div>
            <strong>This is an emergency. Contact a veterinary clinic now.</strong>
            <p>
              Do not wait for the wound check. Keep your pet calm and still, and press a clean cloth
              on any bleeding on the way.
            </p>
            <Link to="/clinics?emergency=true" className="btn btn--primary btn--sm">
              Find an emergency clinic
            </Link>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function SymptomQuestionList({
  value,
  onChange,
}: {
  value: DraftAnswers;
  onChange: (next: DraftAnswers) => void;
}) {
  return (
    <>
      {SYMPTOM_QUESTIONS.map((question) =>
        question.type === 'multiple' ? (
          <fieldset key={question.id} className="question">
            <legend className="question__legend">{question.label}</legend>
            <div className="option-grid">
              {question.options.map((option) => (
                <label key={option.id} className="option">
                  <input
                    type="checkbox"
                    disabled={value.signsUnsure}
                    checked={!value.signsUnsure && value.signs.includes(option.id)}
                    onChange={() => onChange({ ...value, signs: toggle(value.signs, option.id) })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="option option--unsure">
                <input
                  type="checkbox"
                  checked={value.signsUnsure}
                  onChange={() => onChange({ ...value, signsUnsure: !value.signsUnsure })}
                />
                <span>Not sure</span>
              </label>
            </div>
          </fieldset>
        ) : (
          <fieldset key={question.id} className="question">
            <legend className="question__legend">{question.label}</legend>
            <div className="option-grid">
              {[...question.options, { id: '', label: 'Not sure' }].map((option) => (
                <label
                  key={option.id || 'unsure'}
                  className={option.id ? 'option' : 'option option--unsure'}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={(value.single[question.id] ?? '') === option.id}
                    onChange={() =>
                      onChange({
                        ...value,
                        single: { ...value.single, [question.id]: option.id || null },
                      })
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ),
      )}
    </>
  );
}
