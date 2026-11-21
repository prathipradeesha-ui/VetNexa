import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute, signedOut } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const owner = { status: 200, body: { user: demoOwner } };
const rescuerUser = {
  status: 200,
  body: {
    user: { ...demoOwner, id: 'r1', firstName: 'Dilan', fullName: 'Dilan G', role: 'RESCUER' },
  },
};

const coco = {
  id: 'l1',
  name: 'Coco',
  species: 'DOG',
  breed: 'Mixed breed',
  sex: 'FEMALE',
  ageGroup: 'YOUNG',
  approxAgeMonths: 10,
  size: 'Medium',
  city: 'Colombo',
  description: 'A playful young dog who loves car rides.',
  healthSummary: 'Vaccinated and spayed.',
  isVaccinated: true,
  isNeutered: true,
  goodWithChildren: true,
  goodWithPets: null,
  photoUrl: null,
  status: 'AVAILABLE',
  createdAt: '2026-11-01T00:00:00.000Z',
  rescuer: 'Dilan G.',
};

describe('adoption pages', () => {
  it('lists animals with filters kept in the address bar', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/adoption/listings': {
        status: 200,
        body: { listings: [coco], cities: ['Colombo'] },
      },
      'GET /api/adoption/listings?species=CAT': {
        status: 200,
        body: { listings: [], cities: ['Colombo'] },
      },
    });
    const { router } = renderRoute('/adopt');

    expect(await screen.findByRole('link', { name: 'Coco' })).toHaveAttribute('href', '/adopt/l1');
    expect(screen.getByText('Mixed breed · Female · Young · Medium')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Species'), 'CAT');
    await waitFor(() => expect(router.state.location.search).toBe('?species=CAT'));
    expect(await screen.findByText(/No animals match these filters/)).toBeInTheDocument();
  });

  it('shows known traits only and invites visitors to sign in', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/adoption/listings/l1': {
        status: 200,
        body: { listing: { ...coco, isMine: false, myApplication: null, canApply: false } },
      },
    });
    renderRoute('/adopt/l1');

    expect(await screen.findByRole('heading', { name: 'Coco', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Good with children/)).toBeInTheDocument();
    expect(screen.queryByText(/Good with other pets/)).not.toBeInTheDocument(); // unknown
    const prompt = within(screen.getByText(/Would you like to adopt Coco/).closest('p')!);
    expect(prompt.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets an owner apply with their phone number filled in', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': owner,
      'GET /api/adoption/listings/l1': {
        status: 200,
        body: { listing: { ...coco, isMine: false, myApplication: null, canApply: true } },
      },
      'POST /api/adoption/listings/l1/applications': {
        status: 201,
        body: { application: { id: 'a1', status: 'SUBMITTED' } },
      },
    });
    renderRoute('/adopt/l1');

    expect(await screen.findByLabelText('Mobile number')).toHaveValue(demoOwner.phone);
    await userEvent.selectOptions(screen.getByLabelText('Your home'), 'House with garden');
    await userEvent.click(screen.getByLabelText('I have other pets'));
    await userEvent.type(
      screen.getByLabelText('Why would you like to adopt Coco?'),
      'We have a big garden and work from home most days of the week.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send application' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(call![1]!.body as string)).toMatchObject({
        homeType: 'House with garden',
        hasOtherPets: true,
        hasChildren: false,
        contactPhone: demoOwner.phone,
      });
    });
  });
});

describe('rescuer application review', () => {
  it('sends an approval with the rescuer’s message', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': rescuerUser,
      'GET /api/adoption/listings/l1/applications': {
        status: 200,
        body: {
          listing: coco,
          applications: [
            {
              id: 'a1',
              status: 'SUBMITTED',
              homeType: 'House with garden',
              hasOtherPets: true,
              hasChildren: false,
              contactPhone: '0769876543',
              message: 'We have a big garden.',
              rescuerNotes: null,
              createdAt: '2026-11-18T10:00:00.000Z',
              applicant: { name: 'Tharushi Fernando', email: 't@example.com', city: 'Negombo' },
            },
          ],
        },
      },
      'PATCH /api/adoption/applications/a1/decision': { status: 200, body: {} },
    });
    renderRoute('/dashboard/listings/l1');

    const application = (await screen.findByText('Tharushi Fernando')).closest('li')!;
    expect(within(application).getByRole('link', { name: '0769876543' })).toBeInTheDocument();
    await userEvent.type(
      within(application).getByLabelText(/Message to the applicant/),
      'Home visit went well',
    );
    await userEvent.click(within(application).getByRole('button', { name: 'Approve adoption' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        status: 'APPROVED',
        rescuerNotes: 'Home visit went well',
      });
    });
  });
});

const report = {
  id: 'rep1',
  species: 'DOG',
  title: 'Injured puppy near bus stand',
  description: 'Small brown puppy limping.',
  locationText: 'Negombo main bus stand',
  city: 'Negombo',
  latitude: null,
  longitude: null,
  urgency: 'CRITICAL',
  status: 'OPEN',
  photoUrl: null,
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  reporter: { name: 'Tharushi F.', phone: '0769876543', isMe: false },
  assignedTo: null,
  actions: { canTakeOn: true, canResolve: false, canClose: false, canChangePhoto: false },
};

describe('rescue', () => {
  it('shows rescuers the board with urgency and lets them take on a report', async () => {
    // The fake server remembers that the report was taken on, like the real one.
    const takenOn = {
      ...report,
      status: 'IN_PROGRESS',
      assignedTo: { name: 'Dilan G', phone: null, isMe: true },
      actions: { ...report.actions, canTakeOn: false, canResolve: true },
    };
    let current: typeof report | typeof takenOn = report;
    const fetchMock = mockApi({
      'GET /api/auth/me': rescuerUser,
      'GET /api/rescue/rep1': () => ({ status: 200, body: { report: current } }),
      'POST /api/rescue/rep1/take-on': () => {
        current = takenOn;
        return { status: 200, body: { report: takenOn } };
      },
    });
    renderRoute('/dashboard/rescue/rep1');

    expect(await screen.findByText('Critical')).toBeInTheDocument();
    expect(screen.getByText(/reported 2 hours ago/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0769876543' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /take this rescue/ }));

    expect(await screen.findByRole('button', { name: 'Mark as rescued' })).toBeInTheDocument();
    expect(screen.getByText('You are handling this rescue')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rescue/rep1/take-on',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('checks a new report for enough detail before sending', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': owner });
    renderRoute('/dashboard/rescue/new');

    await userEvent.click(await screen.findByRole('button', { name: 'Send report' }));

    expect(await screen.findByText(/Please choose dog or cat/)).toBeInTheDocument();
    expect(screen.getByText(/describe where the animal is/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/rescue',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
