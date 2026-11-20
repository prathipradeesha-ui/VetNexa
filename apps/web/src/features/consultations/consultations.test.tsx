import { isoToColombo } from '@vetnexa/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const owner = { status: 200, body: { user: demoOwner } };
const vetUser = {
  status: 200,
  body: {
    user: {
      ...demoOwner,
      id: 'vet-1',
      firstName: 'Ruwan',
      lastName: 'Senanayake',
      fullName: 'Ruwan Senanayake',
      role: 'VET',
      vetProfile: {
        licenseNumber: 'SLVC-1',
        specialization: null,
        yearsExperience: 8,
        clinicId: 'c1',
        isVerified: true,
      },
    },
  },
};
const inDays = (days: number) =>
  isoToColombo(new Date(Date.now() + days * 86_400_000).toISOString()).date;

const consultation = {
  id: 'con-1',
  status: 'REQUESTED',
  type: 'IN_PERSON',
  scheduledAt: '2026-11-26T10:30:00.000Z',
  reason: 'Annual vaccination booster.',
  diagnosis: null,
  treatment: null,
  vetNotes: null,
  followUpAt: null,
  pet: {
    id: 'pet-1',
    name: 'Bruno',
    species: 'DOG',
    breed: 'Labrador',
    photoUrl: null,
    dateOfBirth: null,
  },
  vet: { id: 'vet-1', name: 'Dr. Ruwan Senanayake' },
  clinic: {
    id: 'c1',
    name: 'Green Paws',
    slug: 'green-paws',
    phone: '0112812236',
    city: 'Nugegoda',
  },
  owner: null,
  actions: { canConfirm: false, canComplete: false, canCancel: true, canViewPatient: false },
  createdAt: '2026-11-20T10:00:00.000Z',
};

describe('booking a consultation', () => {
  const bookingApi = (extra = {}) =>
    mockApi({
      'GET /api/auth/me': owner,
      'GET /api/pets': {
        status: 200,
        body: { pets: [{ id: 'pet-1', name: 'Bruno', species: 'DOG', photoUrl: null }] },
      },
      'GET /api/vets': {
        status: 200,
        body: {
          vets: [
            {
              id: 'vet-1',
              name: 'Dr. Ruwan Senanayake',
              specialization: 'Preventive care',
              yearsExperience: 8,
              clinic: { id: 'c1', name: 'Green Paws', city: 'Nugegoda' },
            },
          ],
        },
      },
      ...extra,
    });

  async function fillForm(time: string) {
    await userEvent.selectOptions(await screen.findByLabelText('Veterinarian'), 'vet-1');
    await userEvent.type(screen.getByLabelText('Date'), inDays(3));
    await userEvent.selectOptions(screen.getByLabelText('Time'), time);
    await userEvent.type(
      screen.getByLabelText('Reason for the visit'),
      'Limping on the right hind leg.',
    );
  }

  it('preselects the only pet and groups vets by clinic', async () => {
    bookingApi();
    renderRoute('/dashboard/consultations/new');

    expect(await screen.findByLabelText('Pet')).toHaveValue('pet-1');
    expect(screen.getByRole('group', { name: 'Green Paws, Nugegoda' })).toBeInTheDocument();
  });

  it('rejects times outside clinic hours in the form', async () => {
    const fetchMock = bookingApi();
    renderRoute('/dashboard/consultations/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Request consultation' }));

    expect(await screen.findByText('Please choose a veterinarian')).toBeInTheDocument();
    expect(screen.getByText('Please choose a time')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/consultations',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a double-booking conflict beside the time and books once a free slot is chosen', async () => {
    let attempts = 0;
    bookingApi({
      'POST /api/consultations': () =>
        ++attempts === 1
          ? {
              status: 409,
              body: {
                error: {
                  code: 'CONFLICT',
                  message: 'Dr. Senanayake is already booked at this time.',
                  details: [
                    { field: 'time', message: 'Dr. Senanayake is already booked at this time.' },
                  ],
                },
              },
            }
          : { status: 201, body: { consultation } },
      'GET /api/consultations/con-1': { status: 200, body: { consultation } },
    });
    const { router } = renderRoute('/dashboard/consultations/new');

    await fillForm('16:00');
    await userEvent.click(screen.getByRole('button', { name: 'Request consultation' }));
    expect(
      await screen.findByText('Dr. Senanayake is already booked at this time.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toHaveFocus();

    await userEvent.selectOptions(screen.getByLabelText('Time'), '16:30');
    await userEvent.click(screen.getByRole('button', { name: 'Request consultation' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/dashboard/consultations/con-1'),
    );
    expect(await screen.findByText('Request sent')).toBeInTheDocument();
  });
});

describe('consultation page', () => {
  it('gives the vet confirm, decline and patient history actions with owner contact', async () => {
    mockApi({
      'GET /api/auth/me': vetUser,
      'GET /api/consultations/con-1': {
        status: 200,
        body: {
          consultation: {
            ...consultation,
            owner: { name: 'Nimali Perera', phone: '0771234567', email: 'nimali@example.com' },
            actions: {
              canConfirm: true,
              canComplete: false,
              canCancel: true,
              canViewPatient: true,
            },
          },
        },
      },
    });
    renderRoute('/dashboard/consultations/con-1');

    const actions = within(await screen.findByRole('region', { name: 'Actions' }));
    expect(actions.getByRole('button', { name: 'Confirm appointment' })).toBeInTheDocument();
    expect(actions.getByRole('button', { name: 'Decline request' })).toBeInTheDocument();
    expect(actions.getByRole('link', { name: /health history/ })).toHaveAttribute(
      'href',
      '/dashboard/patients/pet-1',
    );
    expect(screen.getByRole('link', { name: '0771234567' })).toBeInTheDocument();
  });

  it('asks the owner to confirm a cancellation and sends the reason', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': owner,
      'GET /api/consultations/con-1': { status: 200, body: { consultation } },
      'PATCH /api/consultations/con-1/status': {
        status: 200,
        body: {
          consultation: {
            ...consultation,
            status: 'CANCELLED',
            actions: { ...consultation.actions, canCancel: false },
          },
        },
      },
    });
    renderRoute('/dashboard/consultations/con-1');

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
    await userEvent.type(screen.getByLabelText(/Reason/), 'Bruno is better');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        status: 'CANCELLED',
        note: 'Bruno is better',
      });
    });
  });

  it('shows the outcome of a completed consultation', async () => {
    mockApi({
      'GET /api/auth/me': owner,
      'GET /api/consultations/con-1': {
        status: 200,
        body: {
          consultation: {
            ...consultation,
            status: 'COMPLETED',
            diagnosis: 'Healthy',
            treatment: 'DHPPi booster given',
            followUpAt: '2026-12-03T03:30:00.000Z',
            actions: {
              canConfirm: false,
              canComplete: false,
              canCancel: false,
              canViewPatient: false,
            },
          },
        },
      },
    });
    renderRoute('/dashboard/consultations/con-1');

    const outcome = within(await screen.findByRole('region', { name: 'Outcome' }));
    expect(outcome.getByText('DHPPi booster given')).toBeInTheDocument();
    expect(outcome.getByText('3 Dec 2026')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Actions' })).not.toBeInTheDocument();
  });
});

describe('vet dashboard', () => {
  it('shows pending requests and today’s schedule', async () => {
    mockApi({
      'GET /api/auth/me': vetUser,
      'GET /api/vet/summary': {
        status: 200,
        body: {
          pendingRequests: 2,
          upcomingWeek: 3,
          completedThisMonth: 5,
          today: [
            {
              ...consultation,
              status: 'CONFIRMED',
              owner: { name: 'Nimali Perera', phone: null, email: 'n@example.com' },
            },
          ],
        },
      },
    });
    renderRoute('/dashboard');

    const requests = await screen.findByRole('link', { name: /New requests/ });
    await waitFor(() => expect(requests).toHaveTextContent('2'));
    expect(requests).toHaveAttribute('href', '/dashboard/consultations?view=requests');
    const today = within(screen.getByRole('region', { name: /Today’s appointments/ }));
    expect(today.getByText('Owner: Nimali Perera')).toBeInTheDocument();
  });
});
