import { z } from 'zod';

/**
 * Symptom and context questionnaire for the wound check (the second input of the multimodal
 * assessment). The AI service holds the same questions, plus the weighted rules, in
 * services/ai/vetnexa_ai/questionnaire.json; a test checks that both lists match exactly.
 */

export const RED_FLAGS = [
  { id: 'heavy_bleeding', label: 'Bleeding that does not stop after 5 minutes of firm pressure' },
  { id: 'breathing_difficulty', label: 'Difficulty breathing, gasping or blue gums' },
  { id: 'collapse', label: 'Collapsed, unable to stand or not responding normally' },
  {
    id: 'deep_or_penetrating',
    label: 'A very deep wound, bone or organs visible, or an object stuck in it',
  },
  { id: 'major_trauma', label: 'Hit by a vehicle or fell from a height' },
  { id: 'eye_injury', label: 'Injury to the eye itself' },
  { id: 'rapid_swelling', label: 'Face or throat swelling quickly, or a possible snake bite' },
  { id: 'seizure', label: 'Seizure (fit)' },
] as const;

export type RedFlagId = (typeof RED_FLAGS)[number]['id'];

export const SYMPTOM_QUESTIONS = [
  {
    id: 'bodyLocation',
    label: 'Where is the problem?',
    type: 'single',
    options: [
      { id: 'head_face', label: 'Head or face' },
      { id: 'ear', label: 'Ear' },
      { id: 'eye_area', label: 'Around the eye' },
      { id: 'mouth', label: 'Mouth or lips' },
      { id: 'neck', label: 'Neck' },
      { id: 'chest', label: 'Chest' },
      { id: 'back', label: 'Back' },
      { id: 'belly', label: 'Belly' },
      { id: 'front_leg', label: 'Front leg' },
      { id: 'back_leg', label: 'Back leg' },
      { id: 'paw', label: 'Paw or toes' },
      { id: 'tail', label: 'Tail' },
      { id: 'genital_anal', label: 'Genital or bottom area' },
      { id: 'several', label: 'Several places' },
    ],
  },
  {
    id: 'duration',
    label: 'How long has it been there?',
    type: 'single',
    options: [
      { id: 'under_24h', label: 'Less than a day' },
      { id: '1_3_days', label: '1–3 days' },
      { id: '4_7_days', label: '4–7 days' },
      { id: 'over_week', label: 'More than a week' },
    ],
  },
  {
    id: 'cause',
    label: 'Do you know what caused it?',
    type: 'single',
    options: [
      { id: 'bite_fight', label: 'A bite or a fight with another animal' },
      { id: 'accident', label: 'An accident or a fall' },
      { id: 'sharp_object', label: 'A sharp object, such as glass or wire' },
      { id: 'surgery', label: 'It is a surgery or stitch site' },
      { id: 'insect_tick', label: 'An insect bite or tick' },
      { id: 'none_noticed', label: 'It appeared without an obvious cause' },
    ],
  },
  {
    id: 'signs',
    label: 'What do you see? (choose all that apply)',
    type: 'multiple',
    options: [
      { id: 'open_wound', label: 'An open wound or cut' },
      { id: 'bleeding', label: 'Some bleeding' },
      { id: 'swelling', label: 'Swelling' },
      { id: 'pus', label: 'Pus or yellow-green discharge' },
      { id: 'bad_smell', label: 'A bad smell' },
      { id: 'red_hot', label: 'Red or hot skin' },
      { id: 'hair_loss', label: 'Hair loss' },
      { id: 'itching', label: 'Scratching or itching' },
      { id: 'scabs', label: 'Scabs or crusts' },
      { id: 'lump', label: 'A lump' },
      { id: 'licking', label: 'Keeps licking the area' },
      { id: 'limping', label: 'Limping' },
    ],
  },
  {
    id: 'appetite',
    label: 'Is your pet eating?',
    type: 'single',
    options: [
      { id: 'normal', label: 'Normally' },
      { id: 'less', label: 'Less than usual' },
      { id: 'not_eating', label: 'Not eating' },
    ],
  },
  {
    id: 'energy',
    label: "How is your pet's energy?",
    type: 'single',
    options: [
      { id: 'normal', label: 'Normal' },
      { id: 'lower', label: 'Quieter than usual' },
      { id: 'very_low', label: 'Very weak or hiding' },
    ],
  },
  {
    id: 'pain',
    label: 'Does it seem painful?',
    type: 'single',
    options: [
      { id: 'none', label: 'No' },
      { id: 'mild', label: 'A little, when touched' },
      { id: 'severe', label: 'Very painful, cries or will not let you touch' },
    ],
  },
] as const;

type Question = (typeof SYMPTOM_QUESTIONS)[number];
type OptionId<Q extends Question> = Q['options'][number]['id'];
type SingleQuestion = Extract<Question, { type: 'single' }>;
type SignId = OptionId<Extract<Question, { id: 'signs' }>>;

/** Answers as sent to the API. `null` (or missing) means "not sure". */
export type SymptomAnswers = {
  redFlags: RedFlagId[];
  signs: SignId[] | null;
} & { [Q in SingleQuestion as Q['id']]: OptionId<Q> | null };

const optionIds = (id: string) =>
  SYMPTOM_QUESTIONS.find((q) => q.id === id)!.options.map((o) => o.id) as [string, ...string[]];

const single = (id: string) => z.enum(optionIds(id)).nullable().default(null);

/** Validates questionnaire answers (the API adds the pet's species before sending them on). */
export const symptomAnswersSchema = z.object({
  redFlags: z
    .array(z.enum(RED_FLAGS.map((f) => f.id) as [RedFlagId, ...RedFlagId[]]))
    .max(RED_FLAGS.length)
    .default([])
    .transform((list) => [...new Set(list)]),
  bodyLocation: single('bodyLocation'),
  duration: single('duration'),
  cause: single('cause'),
  signs: z
    .array(z.enum(optionIds('signs')))
    .max(20)
    .nullable()
    .default(null)
    .transform((list) => (list ? [...new Set(list)] : null)),
  appetite: single('appetite'),
  energy: single('energy'),
  pain: single('pain'),
});

export const TRIAGE_LEVEL_LABELS = {
  routine: 'Routine care',
  consult: 'Veterinary consultation recommended',
  urgent: 'Urgent veterinary attention',
} as const;

/** Symptom evidence returned by the AI service (see services/ai/vetnexa_ai/symptoms.py). */
export interface SymptomEvidence {
  species: 'dog' | 'cat';
  redFlags: { id: RedFlagId; label: string }[];
  risk: number;
  level: keyof typeof TRIAGE_LEVEL_LABELS;
  rules: { id: string; weight: number; reason: string }[];
  completeness: number;
  missing: string[];
  questionnaireVersion: string;
}

/** Label for one answer, e.g. answerLabel('duration', '1_3_days') → "1–3 days". */
export function answerLabel(questionId: string, optionId: string) {
  const question = SYMPTOM_QUESTIONS.find((q) => q.id === questionId);
  return question?.options.find((o) => o.id === optionId)?.label ?? optionId;
}
