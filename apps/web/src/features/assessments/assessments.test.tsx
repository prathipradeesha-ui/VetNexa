import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute } from '../../test/render';

const signedInOwner = { status: 200, body: { user: demoOwner } };
const available = { status: 200, body: { available: true, demoModel: true, modelVersion: 'v1' } };

const pet = (id: string, name: string, species: string) => ({
  id,
  name,
  species,
  breed: null,
  sex: 'MALE',
  dateOfBirth: null,
  weightKg: null,
  color: null,
  microchipId: null,
  isNeutered: false,
  photoUrl: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  recordCount: 0,
  nextDue: null,
});

const result = {
  id: 'a-1',
  pet: { id: 'pet-1', name: 'Bruno', species: 'DOG' },
  imageUrl: '/uploads/wounds/abc.webp',
  status: 'ASSESSED',
  predictedClass: 'laceration',
  confidence: 0.81,
  severity: 'MODERATE',
  referToVet: true,
  escalated: false,
  probabilities: {
    laceration: 0.81,
    abrasion: 0.1,
    puncture_wound: 0.05,
    abscess_or_infection: 0.03,
    healthy_skin: 0.01,
  },
  summary: 'The photo most likely shows a cut (laceration).',
  guidance: 'Contact a veterinarian within 24 hours.',
  modelVersion: 'wound-resnet18-test',
  demoModel: true,
  ownerNotes: null,
  triage: 'CONSULT',
  triageDetails: {
    outcome: 'CONSULT',
    label: 'Veterinary consultation recommended',
    combinedRisk: 0.48,
    reliability: 0.93,
    inputs: [
      {
        source: 'image',
        risk: 0.47,
        level: 'CONSULT',
        reliability: 0.78,
        weight: 0.44,
        notes: [],
        quality: 1,
        familiarity: 0.92,
        certainty: 0.7,
        topClass: 'laceration',
      },
      {
        source: 'symptoms',
        risk: 0.49,
        level: 'CONSULT',
        reliability: 1,
        weight: 0.56,
        notes: [],
      },
    ],
    overrides: ['Photos showing a cut (laceration) always need a veterinarian.'],
    fusion: 'reliability',
  },
  disclaimer: 'This is a preliminary, AI-generated assessment. It is not a diagnosis.',
  createdAt: '2026-11-21T09:30:00.000Z',
};

const photo = () => new File(['fake-jpeg'], 'wound.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  // jsdom has no object URLs; the preview only needs a string.
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wound check history', () => {
  it('lists earlier results with severity and a demo-model label', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments': { status: 200, body: { assessments: [result] } },
      'GET /api/assessments/status': available,
    });
    renderRoute('/dashboard/assessments');

    const row = (await screen.findByText('Bruno')).closest('a')!;
    expect(row).toHaveAttribute('href', '/dashboard/assessments/a-1');
    expect(within(row).getByText('Cut (laceration) · 81% confidence')).toBeInTheDocument();
    expect(within(row).getByText('See a vet')).toBeInTheDocument();
    expect(within(row).getByText('Demo model')).toBeInTheDocument();
    expect(screen.getByText(/Emergency\?/)).toBeInTheDocument();
  });

  it('explains when the AI service is unavailable', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments': { status: 200, body: { assessments: [] } },
      'GET /api/assessments/status': {
        status: 200,
        body: { available: false, demoModel: false, modelVersion: null },
      },
    });
    renderRoute('/dashboard/assessments');
    expect(await screen.findByText('Wound check is not available right now')).toBeInTheDocument();
  });
});

describe('new wound check', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/status': available,
      'GET /api/pets': { status: 200, body: { pets: [pet('pet-1', 'Bruno', 'DOG')] } },
      ...extra,
    } as Parameters<typeof mockApi>[0]);

  /** Answers the symptom step: a bite, 1–3 days, swelling, everything else "Not sure". */
  async function answerSymptoms() {
    await userEvent.click(
      await screen.findByRole('radio', { name: 'A bite or a fight with another animal' }),
    );
    await userEvent.click(screen.getByRole('radio', { name: '1–3 days' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Swelling' }));
  }

  it('asks for a pet first and shows red-flag emergencies at once', async () => {
    const fetchMock = setup();
    renderRoute('/dashboard/assessments/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByText('Please choose which pet the photo is of')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Which pet?'), 'pet-1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Difficulty breathing/ }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This is an emergency');
    expect(within(alert).getByRole('link', { name: 'Find an emergency clinic' })).toHaveAttribute(
      'href',
      '/clinics?emergency=true',
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/assessments', expect.anything());
  });

  it('requires a photo and the acknowledgement on the last step', async () => {
    setup();
    renderRoute('/dashboard/assessments/new?petId=pet-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Check wound' }));
    expect(screen.getByText('Please add a photo of the wound')).toBeInTheDocument();
    expect(
      screen.getByText('Please confirm you understand this is not a diagnosis'),
    ).toBeInTheDocument();
  });

  it('sends the photo with the symptom answers and opens the result', async () => {
    const fetchMock = setup({
      'POST /api/assessments': { status: 201, body: { assessment: result } },
    });
    const { router } = renderRoute('/dashboard/assessments/new?petId=pet-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await answerSymptoms();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.upload(await screen.findByLabelText('Photo of the wound'), photo());
    expect(screen.getByAltText('Chosen wound photo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/assessments/a-1'));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/assessments')!;
    const form = init!.body as FormData;
    expect(form.get('petId')).toBe('pet-1');
    expect(form.get('photo')).toBeInstanceOf(File);
    expect(JSON.parse(String(form.get('answers')))).toEqual({
      redFlags: [],
      bodyLocation: null,
      duration: '1_3_days',
      cause: 'bite_fight',
      appetite: null,
      energy: null,
      pain: null,
      signs: ['swelling'],
    });
  });

  it('keeps answers when going back and sends "Not sure" for signs when ticked', async () => {
    const fetchMock = setup({
      'POST /api/assessments': { status: 201, body: { assessment: result } },
    });
    renderRoute('/dashboard/assessments/new?petId=pet-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await answerSymptoms();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('radio', { name: '1–3 days' })).toBeChecked();

    const signs = screen.getByRole('group', { name: /What do you see/ });
    await userEvent.click(within(signs).getByRole('checkbox', { name: 'Not sure' }));
    expect(within(signs).getByRole('checkbox', { name: 'Swelling' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.upload(await screen.findByLabelText('Photo of the wound'), photo());
    await userEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/assessments', expect.anything()),
    );
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/assessments')!;
    expect(JSON.parse(String((init!.body as FormData).get('answers'))).signs).toBeNull();
  });

  it('shows photo-quality advice when the photo is rejected', async () => {
    setup({
      'POST /api/assessments': {
        status: 422,
        body: {
          error: {
            code: 'PHOTO_QUALITY',
            message: 'This photo cannot be assessed reliably',
            details: { problems: ['The photo is too dark. Use daylight or a bright room.'] },
          },
        },
      },
    });
    renderRoute('/dashboard/assessments/new?petId=pet-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.upload(await screen.findByLabelText('Photo of the wound'), photo());
    await userEvent.click(screen.getByRole('checkbox', { name: /I understand/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));

    expect(await screen.findByText('This photo cannot be assessed reliably')).toBeInTheDocument();
    expect(screen.getByText(/The photo is too dark/)).toBeInTheDocument();
  });
});

describe('wound check result', () => {
  it('explains how the symptom answers were used', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/a-1': {
        status: 200,
        body: {
          assessment: {
            ...result,
            answers: {
              redFlags: [],
              bodyLocation: 'paw',
              duration: '1_3_days',
              cause: 'bite_fight',
              signs: ['swelling'],
              appetite: null,
              energy: null,
              pain: null,
            },
            symptoms: {
              species: 'dog',
              redFlags: [],
              risk: 0.45,
              level: 'consult',
              rules: [
                { id: 'bite', weight: 0.35, reason: 'Bite wounds often hide deep damage.' },
                { id: 'swelling', weight: 0.15, reason: 'Swelling can mean infection.' },
              ],
              completeness: 4 / 7,
              missing: ['appetite', 'energy', 'pain'],
              questionnaireVersion: 'test',
            },
          },
        },
      },
    });
    renderRoute('/dashboard/assessments/a-1');

    const heading = await screen.findByRole('heading', { name: /How your answers were used/ });
    const panel = heading.closest('section')!;
    expect(within(panel).getByText('Veterinary consultation recommended')).toBeInTheDocument();
    expect(within(panel).getByText('Bite wounds often hide deep damage.')).toBeInTheDocument();
    expect(within(panel).getByText('+35%')).toBeInTheDocument();
    expect(within(panel).getByText(/You answered 4 of 7 questions/)).toBeInTheDocument();
    expect(within(panel).getByText('Paw or toes')).toBeInTheDocument();
  });

  it('says when no symptom answers were given', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/a-1': {
        status: 200,
        body: { assessment: { ...result, answers: null, symptoms: null } },
      },
    });
    renderRoute('/dashboard/assessments/a-1');
    expect(await screen.findByText(/based on the photo only/)).toBeInTheDocument();
  });

  it('shows severity, confidence, guidance, referral and disclaimer', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/a-1': { status: 200, body: { assessment: result } },
    });
    renderRoute('/dashboard/assessments/a-1');

    expect(await screen.findByRole('heading', { name: result.summary })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Model confidence' })).toHaveAttribute(
      'aria-valuenow',
      '81',
    );
    expect(screen.getByText(/Should be seen by a veterinarian/)).toBeInTheDocument();
    expect(screen.getByText('Veterinary consultation recommended')).toBeInTheDocument();
    const why = screen.getByRole('heading', { name: /Why this result/ }).closest('section')!;
    expect(within(why).getByText('counted for 44%')).toBeInTheDocument();
    expect(within(why).getByText('counted for 56%')).toBeInTheDocument();
    expect(within(why).getByText(/always need a veterinarian/)).toBeInTheDocument();
    expect(within(why).getAllByRole('meter', { name: 'Reliability' })[1]).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByText('Contact a veterinarian within 24 hours.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find a clinic/ })).toHaveAttribute('href', '/clinics');
    expect(screen.getByText(/Demonstration model/)).toBeInTheDocument();
    expect(screen.getByText(/It is not a diagnosis/)).toBeInTheDocument();
  });

  it('does not show a confidence figure for an uncertain result', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/a-1': {
        status: 200,
        body: {
          assessment: {
            ...result,
            status: 'UNCERTAIN',
            severity: 'UNCERTAIN',
            triage: 'UNABLE',
            triageDetails: null,
            summary: 'The photo could not be assessed confidently.',
          },
        },
      },
    });
    renderRoute('/dashboard/assessments/a-1');

    expect(await screen.findByText('Unable to assess')).toBeInTheDocument();
    expect(screen.getByText(/no breakdown is available/)).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText(/We recommend a veterinarian/)).toBeInTheDocument();
  });
});
