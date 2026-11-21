import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateFromToday } from '../../test/dates';
import { demoOwner, mockApi, renderRoute } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signedInOwner = { status: 200, body: { user: demoOwner } };
const day = localDateFromToday;

const bruno = {
  id: 'pet-1',
  name: 'Bruno',
  species: 'DOG',
  breed: 'Labrador Retriever',
  sex: 'MALE',
  dateOfBirth: '2022-08-15',
  weightKg: 31.4,
  color: null,
  microchipId: null,
  isNeutered: true,
  photoUrl: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ownerRecord = {
  id: 'rec-1',
  petId: 'pet-1',
  type: 'MEDICATION',
  title: 'Tick and flea prevention',
  description: 'One chewable tablet',
  recordDate: day(-70),
  nextDueDate: day(14),
  vetName: null,
  clinicName: null,
  createdBy: { id: 'user-1', name: 'Nimali Perera', role: 'OWNER' },
  canEdit: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const vetRecord = {
  ...ownerRecord,
  id: 'rec-2',
  type: 'TREATMENT',
  title: 'Paw pad laceration dressed',
  description: null,
  recordDate: day(-45),
  nextDueDate: null,
  vetName: 'Dr. Anjali Wickramasinghe',
  createdBy: { id: 'vet-1', name: 'Dr. Anjali Wickramasinghe', role: 'VET' },
  canEdit: false,
};

function mockPetWithRecords(records: unknown[]) {
  return mockApi({
    'GET /api/auth/me': signedInOwner,
    'GET /api/pets/pet-1': { status: 200, body: { pet: bruno } },
    'GET /api/pets/pet-1/records': { status: 200, body: { records } },
  });
}

describe('health timeline', () => {
  it('lets owners edit their own records but locks records written by a vet', async () => {
    mockPetWithRecords([ownerRecord, vetRecord]);
    renderRoute('/dashboard/pets/pet-1');

    const own = (await screen.findByRole('heading', { name: 'Tick and flea prevention' })).closest(
      'article',
    )!;
    expect(within(own).getByText('Added by you')).toBeInTheDocument();
    expect(
      within(own).getByRole('link', { name: 'Edit Tick and flea prevention' }),
    ).toBeInTheDocument();
    expect(within(own).getByText(/due in 14 days/)).toBeInTheDocument();

    const locked = screen
      .getByRole('heading', { name: 'Paw pad laceration dressed' })
      .closest('article')!;
    expect(within(locked).getByText(/Added by Dr\. Anjali Wickramasinghe/)).toBeInTheDocument();
    expect(within(locked).queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
    expect(within(locked).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('filters records by type', async () => {
    mockPetWithRecords([ownerRecord, vetRecord]);
    renderRoute('/dashboard/pets/pet-1');

    await userEvent.click(await screen.findByRole('button', { name: /Treatment/ }));

    expect(screen.getByRole('button', { name: /Treatment/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Paw pad laceration dressed' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Tick and flea prevention' }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state for a pet without records', async () => {
    mockPetWithRecords([]);
    renderRoute('/dashboard/pets/pet-1');

    expect(await screen.findByText(/No health records yet/)).toBeInTheDocument();
  });

  it('asks for confirmation before deleting a record', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets/pet-1': { status: 200, body: { pet: bruno } },
      'GET /api/pets/pet-1/records': { status: 200, body: { records: [ownerRecord] } },
      'DELETE /api/pets/pet-1/records/rec-1': { status: 204 },
      'GET /api/pets': { status: 200, body: { pets: [] } },
      'GET /api/reminders': { status: 200, body: { reminders: [] } },
    });
    renderRoute('/dashboard/pets/pet-1');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Tick and flea prevention' }),
    );
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Confirm deletion' })).getByRole('button', {
        name: 'Delete',
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pets/pet-1/records/rec-1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });
});

describe('record form', () => {
  it('checks that the next due date comes after the record date', async () => {
    const fetchMock = mockPetWithRecords([]);
    renderRoute('/dashboard/pets/pet-1/records/new');

    await userEvent.selectOptions(await screen.findByLabelText('Type'), 'VACCINATION');
    await userEvent.type(screen.getByLabelText('Title'), 'Anti-rabies vaccine');
    const date = screen.getByLabelText('Date');
    await userEvent.clear(date);
    await userEvent.type(date, day(-1));
    await userEvent.type(screen.getByLabelText(/Next due/), day(-5));
    await userEvent.click(screen.getByRole('button', { name: 'Add record' }));

    expect(
      await screen.findByText('The next due date must be after the record date'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pets/pet-1/records',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('refuses to open a vet-written record for editing', async () => {
    mockPetWithRecords([vetRecord]);
    renderRoute('/dashboard/pets/pet-1/records/rec-2/edit');

    expect(await screen.findByText(/can only be changed by them/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});

describe('care reminders on the dashboard', () => {
  it('lists overdue care first with a count', async () => {
    mockApi({
      'GET /api/auth/me': signedInOwner,
      'GET /api/pets': { status: 200, body: { pets: [] } },
      'GET /api/reminders': {
        status: 200,
        body: {
          reminders: [
            {
              recordId: 'r1',
              type: 'VACCINATION',
              title: 'Anti-rabies vaccine',
              dueDate: day(-25),
              daysUntilDue: -25,
              status: 'OVERDUE',
              pet: { id: 'pet-2', name: 'Rocky', species: 'DOG', photoUrl: null },
            },
            {
              recordId: 'r2',
              type: 'CHECKUP',
              title: 'Blood panel',
              dueDate: day(20),
              daysUntilDue: 20,
              status: 'UPCOMING',
              pet: { id: 'pet-3', name: 'Mimi', species: 'CAT', photoUrl: null },
            },
          ],
        },
      },
    });
    renderRoute('/dashboard');

    const card = (await screen.findByRole('heading', { name: 'Upcoming care' })).closest(
      'section',
    )!;
    expect(await within(card).findByText('1 overdue')).toBeInTheDocument();
    const items = within(card).getAllByRole('link');
    expect(items[0]).toHaveTextContent('Rocky: Anti-rabies vaccine');
    expect(items[0]).toHaveTextContent('Overdue by 25 days');
    expect(items[1]).toHaveTextContent('Due in 20 days');
  });
});
