import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signedInOwner = { status: 200, body: { user: demoOwner } };

const bruno = {
  id: 'pet-1',
  name: 'Bruno',
  species: 'DOG',
  breed: 'Labrador Retriever',
  sex: 'MALE',
  dateOfBirth: '2022-08-15',
  weightKg: 31.4,
  color: 'Golden',
  microchipId: '900164000123456',
  isNeutered: true,
  photoUrl: null,
  notes: 'Allergic to chicken',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('my pets list', () => {
  it('invites the owner to add a first pet when the list is empty', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets': { status: 200, body: { pets: [] } },
    });
    renderRoute('/dashboard/pets');

    expect(await screen.findByRole('heading', { name: 'Add your first pet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add a pet/ })).toHaveAttribute(
      'href',
      '/dashboard/pets/new',
    );
  });

  it('shows each pet with its summary and next due item', async () => {
    const dueDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets': {
        status: 200,
        body: {
          pets: [
            {
              ...bruno,
              recordCount: 5,
              nextDue: { title: 'Rabies booster', type: 'VACCINATION', date: dueDate },
            },
          ],
        },
      },
    });
    renderRoute('/dashboard/pets');

    const card = (await screen.findByRole('heading', { name: 'Bruno' })).closest('a')!;
    expect(card).toHaveAttribute('href', '/dashboard/pets/pet-1');
    expect(within(card).getByText(/Labrador Retriever · Male/)).toBeInTheDocument();
    expect(within(card).getByText('5 health records')).toBeInTheDocument();
    expect(within(card).getByText('Rabies booster: Due in 5 days')).toBeInTheDocument();
  });

  it('is not available to other roles', async () => {
    mockApi({
      'GET /api/auth/me': { status: 200, body: { user: { ...demoOwner, role: 'RESCUER' } } },
    });
    const { router } = renderRoute('/dashboard/pets');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('add a pet', () => {
  it('validates required fields before saving', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': signedInOwner });
    renderRoute('/dashboard/pets/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Add pet' }));

    expect(await screen.findByText('Please enter your pet’s name')).toBeInTheDocument();
    expect(screen.getByText('Please choose a species')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/pets', expect.anything());
  });

  it('saves the pet and opens its profile', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'POST /api/pets': { status: 201, body: { pet: { ...bruno, notes: null } } },
      'GET /api/pets/pet-1': { status: 200, body: { pet: { ...bruno, notes: null } } },
      'GET /api/pets': { status: 200, body: { pets: [] } },
    });
    const { router } = renderRoute('/dashboard/pets/new');

    await userEvent.type(await screen.findByLabelText('Name'), 'Bruno');
    await userEvent.selectOptions(screen.getByLabelText('Species'), 'DOG');
    await userEvent.type(screen.getByLabelText(/Weight/), '31.4');
    await userEvent.click(screen.getByRole('button', { name: 'Add pet' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/pets/pet-1'));
    expect(await screen.findByText('Bruno has been added.')).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls.find(
      ([url, req]) => url === '/api/pets' && req?.method === 'POST',
    )!;
    expect(JSON.parse(init!.body as string)).toMatchObject({
      name: 'Bruno',
      species: 'DOG',
      weightKg: 31.4,
      sex: 'UNKNOWN',
    });
  });
});

describe('pet profile', () => {
  it('shows recorded details and marks missing ones', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets/pet-1': { status: 200, body: { pet: { ...bruno, color: null } } },
    });
    renderRoute('/dashboard/pets/pet-1');

    expect(await screen.findByRole('heading', { name: 'Bruno', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('900164000123456')).toBeInTheDocument();
    expect(screen.getByText('Allergic to chicken')).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded')).toHaveLength(1); // colour
  });

  it('asks for confirmation before deleting', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets/pet-1': { status: 200, body: { pet: bruno } },
      'DELETE /api/pets/pet-1': { status: 204 },
      'GET /api/pets': { status: 200, body: { pets: [] } },
    });
    const { router } = renderRoute('/dashboard/pets/pet-1');

    await userEvent.click(await screen.findByRole('button', { name: /Delete profile/ }));
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pets/pet-1',
      expect.objectContaining({ method: 'DELETE' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete permanently' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/pets'));
  });

  it('rejects unsupported photo types in the browser before uploading', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets/pet-1': { status: 200, body: { pet: bruno } },
    });
    renderRoute('/dashboard/pets/pet-1');

    const input = await screen.findByLabelText('Upload a photo of Bruno');
    await userEvent.upload(input, new File(['%PDF'], 'records.pdf', { type: 'application/pdf' }), {
      applyAccept: false,
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please choose a JPG, PNG or WebP image.',
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/pets/pet-1/photo', expect.anything());
  });
});
