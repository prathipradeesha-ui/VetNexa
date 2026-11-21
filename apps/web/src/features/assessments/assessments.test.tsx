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
    expect(within(row).getByText('Moderate')).toBeInTheDocument();
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
  it('only offers dogs and cats and requires photo and acknowledgement', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/status': available,
      'GET /api/pets': {
        status: 200,
        body: { pets: [pet('pet-1', 'Bruno', 'DOG'), pet('pet-2', 'Coco', 'RABBIT')] },
      },
    });
    renderRoute('/dashboard/assessments/new');

    const select = await screen.findByLabelText('Which pet?');
    expect(within(select).getByRole('option', { name: 'Bruno' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Coco' })).not.toBeInTheDocument();
    expect(screen.getByText(/Demonstration model/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));
    expect(screen.getByText('Please choose which pet the photo is of')).toBeInTheDocument();
    expect(screen.getByText('Please add a photo of the wound')).toBeInTheDocument();
    expect(
      screen.getByText('Please confirm you understand this is not a diagnosis'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/assessments', expect.anything());
  });

  it('uploads the photo and opens the result', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/status': available,
      'GET /api/pets': { status: 200, body: { pets: [pet('pet-1', 'Bruno', 'DOG')] } },
      'POST /api/assessments': { status: 201, body: { assessment: result } },
    });
    const { router } = renderRoute('/dashboard/assessments/new?petId=pet-1');

    await userEvent.upload(await screen.findByLabelText('Photo of the wound'), photo());
    expect(screen.getByAltText('Chosen wound photo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/assessments/a-1'));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/assessments')!;
    const form = init!.body as FormData;
    expect(form.get('petId')).toBe('pet-1');
    expect(form.get('photo')).toBeInstanceOf(File);
  });

  it('shows photo-quality advice when the photo is rejected', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/assessments/status': available,
      'GET /api/pets': { status: 200, body: { pets: [pet('pet-1', 'Bruno', 'DOG')] } },
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

    await userEvent.upload(await screen.findByLabelText('Photo of the wound'), photo());
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Check wound' }));

    expect(await screen.findByText('This photo cannot be assessed reliably')).toBeInTheDocument();
    expect(screen.getByText(/The photo is too dark/)).toBeInTheDocument();
  });
});

describe('wound check result', () => {
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
            summary: 'The photo could not be assessed confidently.',
          },
        },
      },
    });
    renderRoute('/dashboard/assessments/a-1');

    expect(await screen.findByText('Uncertain')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText(/We recommend a veterinarian/)).toBeInTheDocument();
  });
});
