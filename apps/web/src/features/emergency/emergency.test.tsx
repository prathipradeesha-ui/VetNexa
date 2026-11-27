import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderRoute, signedOut } from '../../test/render';

const facets = { cities: ['Colombo', 'Kandy'], services: ['Emergency care'] };
const clinic = (id: string, name: string, lat: number, lng: number) => ({
  id,
  slug: id,
  name,
  addressLine: '1 Main Street',
  city: 'Colombo',
  district: 'Colombo',
  latitude: lat,
  longitude: lng,
  phone: `011${id.padStart(7, '0')}`,
  services: ['Emergency care'],
  hasEmergency: true,
  isOpen24Hours: true,
  isOpenNow: true,
  averageRating: 4.5,
  reviewCount: 2,
  imageUrl: null,
});
// Far clinic first in the API's order; "Near me" must put the close one first.
const far = clinic('1', 'Kandy Night Vet', 7.29, 80.63);
const near = clinic('2', 'Colombo 24h Animal Hospital', 6.91, 79.86);

const assessment = {
  species: 'DOG',
  status: 'ASSESSED',
  predictedClass: 'puncture_wound',
  confidence: 0.8,
  severity: 'MODERATE',
  referToVet: true,
  escalated: false,
  probabilities: { puncture_wound: 0.8 },
  summary: 'The photo most likely shows a puncture wound, such as a bite.',
  guidance: 'Contact a veterinarian within 24 hours.',
  modelVersion: 'test',
  demoModel: true,
  answers: null,
  symptoms: null,
  triage: 'CONSULT',
  triageDetails: null,
  skinCheck: null,
  disclaimer: 'This is a preliminary, AI-generated assessment. It is not a diagnosis.',
};

const baseApi = {
  'GET /api/auth/me': signedOut,
  'GET /api/emergency/status': {
    status: 200,
    body: { available: true, demoModel: true, modelVersion: 'test' },
  },
  'GET /api/clinics?emergency=true': {
    status: 200,
    body: { clinics: [far, near], total: 2, facets },
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('emergency page without an account', () => {
  it('sorts emergency clinics by distance and offers a call button', async () => {
    mockApi(baseApi);
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 6.9, longitude: 79.85 } } as GeolocationPosition),
      },
    });
    renderRoute('/emergency');

    const section = (await screen.findByRole('heading', { name: /Emergency clinics/ })).closest(
      'section',
    )!;
    await within(section).findAllByText('Kandy Night Vet');
    await userEvent.click(within(section).getByRole('button', { name: /Find the nearest/ }));

    const call = await within(section).findByRole('link', { name: /Call Colombo 24h/ });
    expect(call).toHaveAttribute('href', `tel:${near.phone}`);
    const list = section.querySelector('.emergency-clinic-list')!;
    const names = [...list.querySelectorAll('strong')].map((item) => item.textContent);
    expect(names).toEqual(['Colombo 24h Animal Hospital', 'Kandy Night Vet']);
  });

  it('checks a wound without an account and says nothing was saved', async () => {
    const fetchMock = mockApi({
      ...baseApi,
      'POST /api/emergency/assess': { status: 200, body: { assessment, stored: false } },
    });
    renderRoute('/emergency');

    const section = (
      await screen.findByRole('heading', { name: /Check a wound with your camera/ })
    ).closest('section')!;
    await userEvent.click(within(section).getByRole('button', { name: 'Check wound now' }));
    expect(within(section).getByText('Please choose dog or cat')).toBeInTheDocument();

    await userEvent.click(within(section).getByRole('radio', { name: 'Dog' }));
    await userEvent.upload(
      within(section).getByLabelText('Photo of the wound or skin'),
      new File(['jpeg'], 'wound.jpg', { type: 'image/jpeg' }),
    );
    await userEvent.click(within(section).getByRole('checkbox', { name: /I understand/ }));
    await userEvent.click(within(section).getByRole('button', { name: 'Check wound now' }));

    expect(await within(section).findByText(assessment.summary)).toBeInTheDocument();
    expect(within(section).getByText('Veterinary consultation recommended')).toBeInTheDocument();
    expect(section).toHaveTextContent('This result was not saved');
    expect(within(section).getByRole('link', { name: /Create a free account/ })).toHaveAttribute(
      'href',
      '/register',
    );
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/emergency/assess')!;
    const form = init!.body as FormData;
    expect(form.get('species')).toBe('DOG');
    expect(form.get('photo')).toBeInstanceOf(File);
  });

  it('reports an animal without an account and shows a reference number', async () => {
    const fetchMock = mockApi({
      ...baseApi,
      'POST /api/emergency/rescue': {
        status: 201,
        body: { report: { reference: 'AB12CD34', createdAt: '2026-11-21T10:00:00Z' } },
      },
    });
    renderRoute('/emergency');

    const section = (
      await screen.findByRole('heading', { name: /Report an animal in need/ })
    ).closest('section')!;
    const form = within(section);
    await userEvent.selectOptions(form.getByLabelText('Animal'), 'CAT');
    await userEvent.type(form.getByLabelText('Short title'), 'Kitten trapped in a drain');
    await userEvent.type(
      form.getByLabelText('What did you see?'),
      'A small kitten is crying in the drain and cannot climb out.',
    );
    await userEvent.type(form.getByLabelText('Where exactly?'), 'Galle Road, post office');
    await userEvent.type(form.getByLabelText('Town or city'), 'Moratuwa');
    await userEvent.type(form.getByLabelText('Your name'), 'Kamal');
    await userEvent.type(form.getByLabelText('Your phone number'), '0771234567');
    await userEvent.click(form.getByRole('button', { name: 'Send report' }));

    expect(await form.findByText('AB12CD34')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/emergency/rescue')!;
    expect(JSON.parse(String(init!.body))).toMatchObject({
      species: 'CAT',
      reporterName: 'Kamal',
      contactPhone: '0771234567',
      urgency: 'HIGH',
    });
  });
});

describe('floating pet-care assistant', () => {
  it('opens from the corner, answers, and closes with Escape', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/chat': {
        status: 200,
        body: {
          reply: {
            kind: 'smalltalk',
            text: 'Hello! I can answer general questions about dogs and cats.',
            emergency: null,
            article: null,
            related: [],
            suggestions: [],
            actions: [],
            score: null,
            disclaimer: 'General information only, not veterinary advice.',
          },
          saved: false,
        },
      },
    });
    renderRoute('/about');

    const launcher = await screen.findByRole('button', { name: 'Ask VetNexa' });
    await userEvent.click(launcher);
    const panel = await screen.findByRole('dialog', { name: /Ask VetNexa/ });
    await userEvent.type(await within(panel).findByLabelText('Your question'), 'hello{Enter}');
    expect(await within(panel).findByText(/I can answer general questions/)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ask VetNexa' })).toHaveFocus();
  });

  it('is not shown on the full assistant page', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/assistant');
    await screen.findByRole('heading', { name: 'Ask VetNexa', level: 1 });
    expect(screen.queryByRole('button', { name: 'Ask VetNexa' })).not.toBeInTheDocument();
  });
});
