import {
  answerLabel,
  SYMPTOM_QUESTIONS,
  TRIAGE_LEVEL_LABELS,
  type SymptomAnswers,
  type SymptomEvidence,
} from '@vetnexa/shared';
import { ListChecks, Siren } from 'lucide-react';
import { percent } from './AssessmentBits';

const LEVEL_TONE = {
  routine: 'badge',
  consult: 'badge badge--warning',
  urgent: 'badge badge--danger',
} as const;

const questionLabel = (id: string) => SYMPTOM_QUESTIONS.find((q) => q.id === id)?.label ?? id;

/** Explains how the owner's answers (the second input) contributed to the result. */
export function SymptomEvidencePanel({
  answers,
  symptoms,
}: {
  answers: SymptomAnswers | null;
  symptoms: SymptomEvidence | null;
}) {
  if (!symptoms) {
    return (
      <section className="card evidence-panel" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="card-title">
          <ListChecks size={20} aria-hidden="true" /> How your answers were used
        </h2>
        <p className="field__hint">
          No symptom answers were given, so this result is based on the photo only.
        </p>
      </section>
    );
  }

  const answered = SYMPTOM_QUESTIONS.length - symptoms.missing.length;

  return (
    <section className="card evidence-panel" aria-labelledby="evidence-title">
      <h2 id="evidence-title" className="card-title">
        <ListChecks size={20} aria-hidden="true" /> How your answers were used
      </h2>

      {symptoms.redFlags.length > 0 && (
        <div className="evidence-flags">
          <Siren size={18} aria-hidden="true" />
          <div>
            <strong>Emergency signs you reported</strong>
            <ul>
              {symptoms.redFlags.map((flag) => (
                <li key={flag.id}>{flag.label}</li>
              ))}
            </ul>
            <p>
              Emergency signs always mean urgent veterinary attention, whatever the photo shows.
            </p>
          </div>
        </div>
      )}

      <p className="evidence-level">
        On their own, your answers suggest:{' '}
        <span className={LEVEL_TONE[symptoms.level]}>{TRIAGE_LEVEL_LABELS[symptoms.level]}</span>
      </p>

      {symptoms.rules.length > 0 ? (
        <>
          <h3 className="evidence-subtitle">What raised the urgency</h3>
          <ul className="evidence-rules">
            {symptoms.rules.map((rule) => (
              <li key={rule.id}>
                <span>{rule.reason}</span>
                <span className="evidence-rules__weight" title="How much this raises the urgency">
                  +{percent(rule.weight)}
                </span>
              </li>
            ))}
          </ul>
          <p className="field__hint">
            Each answer adds its weight; together they give a symptom risk of{' '}
            {percent(symptoms.risk)}.
          </p>
        </>
      ) : (
        <p className="field__hint">None of your answers raised the urgency.</p>
      )}

      <p className="evidence-completeness">
        You answered {answered} of {SYMPTOM_QUESTIONS.length} questions.
        {symptoms.missing.length > 0 && (
          <>
            {' '}
            Not sure: {symptoms.missing.map(questionLabel).join('; ')}. Missing answers make the
            symptom evidence less reliable.
          </>
        )}
      </p>

      {answers && (
        <details className="evidence-answers">
          <summary>What you told us</summary>
          <dl className="detail-list">
            {SYMPTOM_QUESTIONS.map((question) => {
              const value =
                question.id === 'signs'
                  ? answers.signs === null
                    ? 'Not sure'
                    : answers.signs.length
                      ? answers.signs.map((s) => answerLabel('signs', s)).join(', ')
                      : 'Nothing visible'
                  : answers[question.id]
                    ? answerLabel(question.id, answers[question.id] as string)
                    : 'Not sure';
              return (
                <div key={question.id}>
                  <dt>{question.label}</dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      )}
      <p className="field__hint">
        The questions and their weights are a draft that a veterinarian must review before
        real-world use.
      </p>
    </section>
  );
}
