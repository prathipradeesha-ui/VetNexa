import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const admin = { ...demoOwner, id: 'admin-1', role: 'ADMIN', firstName: 'Ayesha' };
const signedInAdmin = { status: 200, body: { user: admin } };

const stats = {
  generatedAt: '2026-11-21T08:00:00.000Z',
  users: {
    total: 12,
    suspended: 1,
    byRole: { OWNER: 7, VET: 3, RESCUER: 1, ADMIN: 1 },
    newLast30Days: 5,
    signupsByWeek: Array.from({ length: 8 }, (_, i) => ({
      weekStart: `2026-10-${String(5 + i * 3).padStart(2, '0')}`,
      count: i,
    })),
  },
  vets: { verified: 2, pending: 1 },
  pets: { total: 9, bySpecies: { DOG: 5, CAT: 4 } },
  clinics: { active: 6, inactive: 1, emergency: 2 },
  consultations: { total: 4, byStatus: { REQUESTED: 1, CONFIRMED: 1, COMPLETED: 2, CANCELLED: 0 } },
  assessments: {
    total: 3,
    bySeverity: { MINOR: 1, MODERATE: 1, SEVERE: 0, UNCERTAIN: 1 },
    referredToVet: 2,
  },
  assistant: { questions: 20, emergencies: 2 },
  rescue: { open: 3, rescued: 4, total: 8 },
  adoption: { available: 5, pending: 1, adopted: 2 },
  moderation: { reviewsHidden: 0, reviewsTotal: 6, newMessages: 2 },
};

const user = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.com`,
  firstName: 'Kasun',
  lastName: 'Perera',
  phone: null,
  role: 'OWNER',
  status: 'ACTIVE',
  city: 'Colombo',
  createdAt: '2026-10-01T00:00:00.000Z',
  lastLoginAt: null,
  vetProfile: null,
  petCount: 2,
  ...overrides,
});

describe('administration', () => {
  it('shows statistics with links to the work that needs attention', async () => {
    mockApi({
      'GET /api/auth/me': signedInAdmin,
      'GET /api/admin/stats': { status: 200, body: { stats } },
    });
    renderRoute('/dashboard/admin');

    const pending = (await screen.findByText('Vets awaiting verification')).closest('a')!;
    expect(pending).toHaveAttribute('href', '/dashboard/admin/vets');
    expect(within(pending).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2 flagged as emergencies')).toBeInTheDocument();
    // Bar charts print every value, so they can be read without colour.
    const roles = screen.getByRole('heading', { name: 'Users by role' }).closest('section')!;
    expect(within(roles).getByText('Pet owner').nextSibling).toHaveTextContent('7');
    expect(screen.getByText('Show as table')).toBeInTheDocument();
  });

  it('is only for administrators', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: demoOwner } } });
    const { router } = renderRoute('/dashboard/admin/users');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('suspends a user after confirmation, but never the admin themself', async () => {
    let suspended = false;
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInAdmin,
      'GET /api/admin/users?page=1': () => ({
        status: 200,
        body: {
          users: [
            user('u1', { status: suspended ? 'SUSPENDED' : 'ACTIVE' }),
            user('admin-1', { role: 'ADMIN', firstName: 'Ayesha' }),
          ],
          page: 1,
          pageSize: 20,
          total: 2,
          pages: 1,
        },
      }),
      'PATCH /api/admin/users/u1/status': () => {
        suspended = true;
        return { status: 200, body: { user: { id: 'u1', status: 'SUSPENDED' } } };
      },
    });
    renderRoute('/dashboard/admin/users');

    const row = (await screen.findByText('u1@example.com')).closest('tr')!;
    const adminRow = screen.getByText('admin-1@example.com').closest('tr')!;
    expect(within(adminRow).getByText('You')).toBeInTheDocument();
    expect(within(adminRow).queryByRole('button')).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Suspend' }));
    expect(within(row).getByText('Suspend this account?')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm' }));

    expect(await within(row).findByText('Suspended')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/admin/users/u1/status')!;
    expect(JSON.parse(String(init!.body))).toEqual({ status: 'SUSPENDED' });
  });

  it('adds a clinic, sending services as a list', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInAdmin,
      'POST /api/admin/clinics': { status: 201, body: { clinic: { id: 'c1' } } },
      'GET /api/admin/clinics': { status: 200, body: { clinics: [] } },
    });
    const { router } = renderRoute('/dashboard/admin/clinics/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Add clinic' }));
    expect(await screen.findByText('Enter the clinic name')).toBeInTheDocument();
    expect(screen.getByText('Add at least one service')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/clinics', expect.anything());

    await userEvent.type(screen.getByLabelText('Name'), 'Kandy Lake Pet Clinic');
    await userEvent.type(screen.getByLabelText('Street address'), '12 Dalada Veediya');
    await userEvent.type(screen.getByLabelText('Town or city'), 'Kandy');
    await userEvent.type(screen.getByLabelText('District'), 'Kandy');
    await userEvent.type(screen.getByLabelText('Phone'), '0812234567');
    await userEvent.type(screen.getByLabelText('Services'), 'Vaccination{Enter}Surgery');
    await userEvent.click(screen.getByLabelText('Offers emergency care'));
    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/admin/clinics'));
    const [, init] = fetchMock.mock.calls.find(
      ([url, options]) => url === '/api/admin/clinics' && options?.method === 'POST',
    )!;
    expect(JSON.parse(String(init!.body))).toMatchObject({
      name: 'Kandy Lake Pet Clinic',
      services: ['Vaccination', 'Surgery'],
      hasEmergency: true,
      openingHours: { mon: '08:00-18:00', sun: 'Closed' },
    });
  });

  it('hides a review', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInAdmin,
      'GET /api/admin/reviews?page=1': {
        status: 200,
        body: {
          reviews: [
            {
              id: 'r1',
              rating: 1,
              title: null,
              comment: 'Buy cheap watches at example dot com',
              status: 'APPROVED',
              createdAt: '2026-11-01T00:00:00.000Z',
              clinic: { id: 'c1', name: 'Green Paws', slug: 'green-paws' },
              author: { id: 'u1', firstName: 'Spam', lastName: 'Bot', email: 's@example.com' },
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          pages: 1,
        },
      },
      'PATCH /api/admin/reviews/r1': { status: 200, body: { review: { id: 'r1' } } },
    });
    renderRoute('/dashboard/admin/reviews');

    await userEvent.click(await screen.findByRole('button', { name: 'Hide review' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/reviews/r1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'REJECTED' }) }),
      ),
    );
  });

  it('lists new contact messages and changes their status', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedInAdmin,
      'GET /api/admin/messages?status=NEW&page=1': {
        status: 200,
        body: {
          messages: [
            {
              id: 'm1',
              name: 'Kasun',
              email: 'kasun@example.com',
              phone: null,
              topic: 'CLINIC_LISTING',
              message: 'Please list our clinic.',
              status: 'NEW',
              userId: null,
              createdAt: '2026-11-20T00:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          pages: 1,
        },
      },
      'PATCH /api/admin/messages/m1': { status: 200, body: { message: { id: 'm1' } } },
    });
    renderRoute('/dashboard/admin/messages');

    expect(await screen.findByText('Please list our clinic.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /kasun@example.com/ })).toHaveAttribute(
      'href',
      'mailto:kasun@example.com',
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'RESOLVED');
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/messages/m1',
        expect.objectContaining({ body: JSON.stringify({ status: 'RESOLVED' }) }),
      ),
    );
  });
});
