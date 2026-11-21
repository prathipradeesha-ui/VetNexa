import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RED_FLAGS, SYMPTOM_QUESTIONS, symptomAnswersSchema } from './questionnaire';

/** The AI service's copy, which also holds the weighted rules. */
const python = JSON.parse(
  readFileSync(
    new URL('../../../../services/ai/vetnexa_ai/questionnaire.json', import.meta.url),
    'utf8',
  ),
) as {
  redFlags: { id: string; label: string }[];
  questions: { id: string; type: string; options: { id: string; label: string }[] }[];
};

describe('symptom questionnaire', () => {
  it('matches the AI service exactly (ids, types and labels)', () => {
    expect(RED_FLAGS.map((f) => ({ ...f }))).toEqual(python.redFlags);
    expect(
      SYMPTOM_QUESTIONS.map((q) => ({
        id: q.id,
        type: q.type,
        options: q.options.map((o) => ({ ...o })),
      })),
    ).toEqual(python.questions.map(({ id, type, options }) => ({ id, type, options })));
  });

  it('treats missing answers as "not sure" and removes duplicates', () => {
    const answers = symptomAnswersSchema.parse({
      redFlags: ['collapse', 'collapse'],
      signs: ['pus', 'pus'],
    });
    expect(answers).toEqual({
      redFlags: ['collapse'],
      bodyLocation: null,
      duration: null,
      cause: null,
      signs: ['pus'],
      appetite: null,
      energy: null,
      pain: null,
    });
  });

  it('rejects unknown answers', () => {
    expect(symptomAnswersSchema.safeParse({ duration: 'forever' }).success).toBe(false);
    expect(symptomAnswersSchema.safeParse({ redFlags: ['sneezing'] }).success).toBe(false);
  });
});
