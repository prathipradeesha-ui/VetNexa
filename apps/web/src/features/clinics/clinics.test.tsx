import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute, signedOut } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const summary = {
  id: 'c1',
  slug: 'green-paws',
  name: 'Green Paws Veterinary Clinic',
  addressLine: '38 Stanley Thilakaratne Mawatha',
  city: 'Nugegoda',
  district: 'Colombo',
  phone: '0112812236',
  services: ['Vaccination', 'Grooming'],
  hasEmergency: false,
  isOpen24Hours: false,
  isOpenNow: true,
  averageRating: 4.5,
  reviewCount: 2,
  imageUrl: null,
};
const facets = { cities: ['Kandy', 'Nugegoda'], services: ['Grooming', 'Vaccination'] };

const detail = {
  ...summary,
  description: 'Friendly neighbourhood clinic.',
  email: 'hello@greenpaws.lk',
  website: null,
  latitude: 6.87,
  longitude: 79.89,
  openingHours: { mon: '08:30-20:00', sun: 'Closed' },
  vets: [
    {
      id: 'v1',
      name: 'Dr. Ruwan Senanayake',
      specialization: 'Preventive care',
      yearsExperience: 8,
    },
  ],
  ratingDistribution: [
    { stars: 5, count: 1 },
    { stars: 4, count: 1 },
    { stars: 3, count: 0 },
    { stars: 2, count: 0 },
    { stars: 1, count: 0 },
  ],
  reviews: [
    {
      id: 'r1',
      rating: 5,
      title: 'Our regular clinic',
      comment: 'Always remembers our pets.',
      createdAt: '2026-10-01T00:00:00.000Z',
      author: 'Nimali P.',
      isMine: false,
    },
  ],
  myReview: null,
};

describe('clinic directory', () => {
  it('shows clinics with rating and opening status', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/clinics': { status: 200, body: { clinics: [summary], total: 1, facets } },
    });
    renderRoute('/clinics');

    const card = (await screen.findByRole('link', { name: summary.name })).closest('article')!;
    expect(within(card).getByRole('img', { name: '4.5 out of 5 stars' })).toBeInTheDocument();
    expect(within(card).getByText('Open now')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '0112812236' })).toHaveAttribute(
      'href',
      'tel:0112812236',
    );
    expect(screen.getByText('1 clinic found')).toBeInTheDocument();
  });

  it('turns filters into a shareable address and API query', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/clinics': { status: 200, body: { clinics: [summary], total: 1, facets } },
      'GET /api/clinics?city=Kandy': { status: 200, body: { clinics: [], total: 0, facets } },
      'GET /api/clinics?city=Kandy&emergency=true': {
        status: 200,
        body: { clinics: [], total: 0, facets },
      },
    });
    const { router } = renderRoute('/clinics');

    await screen.findByRole('option', { name: 'Kandy' }); // filter options arrive with the results
    await userEvent.selectOptions(screen.getByLabelText('City'), 'Kandy');
    await userEvent.click(screen.getByLabelText(/Emergency care/));

    await waitFor(() => expect(router.state.location.search).toBe('?city=Kandy&emergency=true'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clinics?city=Kandy&emergency=true',
      expect.anything(),
    );
    expect(await screen.findByText(/No clinics match these filters/)).toBeInTheDocument();
  });
});

describe('clinic page', () => {
  it('shows contact details, hours, verified vets and reviews', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/clinics/green-paws': { status: 200, body: { clinic: detail } },
    });
    renderRoute('/clinics/green-paws');

    expect(
      await screen.findByRole('heading', { name: summary.name, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get directions/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=6.87%2C79.89',
    );
    // Without an API key the map is Google's keyless embed of the clinic's position.
    expect(screen.getByTitle(/Map showing/)).toHaveAttribute(
      'src',
      'https://maps.google.com/maps?q=6.87%2C79.89&z=15&output=embed',
    );
    // On a Sunday the row is announced as "Sunday (today)".
    expect(screen.getByRole('rowheader', { name: /^Sunday/ }).nextSibling).toHaveTextContent(
      'Closed',
    );
    expect(screen.getByText('Dr. Ruwan Senanayake')).toBeInTheDocument();
    expect(screen.getByText('Always remembers our pets.')).toBeInTheDocument();
    // Visitors are invited to sign in rather than shown a form.
    const reviews = within(screen.getByRole('region', { name: 'Reviews' }));
    expect(reviews.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Write a review' })).not.toBeInTheDocument();
  });

  it('lets a signed-in owner post a review', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': { status: 200, body: { user: demoOwner } },
      'GET /api/clinics/green-paws': { status: 200, body: { clinic: detail } },
      'PUT /api/clinics/green-paws/reviews/mine': {
        status: 200,
        body: { review: { id: 'r9', rating: 4, title: null, comment: 'Friendly and quick.' } },
      },
    });
    renderRoute('/clinics/green-paws');

    await userEvent.click(await screen.findByRole('button', { name: 'Post review' }));
    expect(await screen.findByText('Please choose a star rating')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '4 stars, Very good' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Friendly and quick.');
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        rating: 4,
        comment: 'Friendly and quick.',
      });
    });
  });

  it('explains why veterinarians cannot review', async () => {
    mockApi({
      'GET /api/auth/me': { status: 200, body: { user: { ...demoOwner, role: 'VET' } } },
      'GET /api/clinics/green-paws': { status: 200, body: { clinic: detail } },
    });
    renderRoute('/clinics/green-paws');

    expect(await screen.findByText(/written by pet owners and rescuers/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post review' })).not.toBeInTheDocument();
  });
});

describe('clinic map and near me', () => {
  const located = (id: string, name: string, lat: number, lng: number) => ({
    ...summary,
    id,
    slug: id,
    name,
    latitude: lat,
    longitude: lng,
  });
  const kandy = located('k', 'Hillside Pet Care Centre', 7.29, 80.63);
  const colombo = located('c', 'Harbourview Animal Hospital', 6.93, 79.84);

  it('sorts by distance, shows how far each clinic is and maps the selected one', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/clinics': { status: 200, body: { clinics: [kandy, colombo], total: 2, facets } },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 6.9, longitude: 79.85 } } as GeolocationPosition),
      },
    });
    renderRoute('/clinics');

    await screen.findByRole('heading', { name: 'Hillside Pet Care Centre' });
    await userEvent.click(screen.getByRole('button', { name: 'Near me' }));
    expect(await screen.findByText(/nearest first/)).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(names.indexOf('Harbourview Animal Hospital')).toBeLessThan(
      names.indexOf('Hillside Pet Care Centre'),
    );
    expect(screen.getAllByText(/km away/)[0]).toHaveTextContent('3.5 km away');

    await userEvent.click(screen.getByRole('button', { name: 'Map' }));
    const map = screen.getByTitle(/Map of veterinary clinics/);
    expect(map.getAttribute('src')).toContain('6.93%2C79.84');
    await userEvent.click(screen.getAllByRole('button', { name: 'Show on map' })[1]!);
    expect(screen.getByTitle(/Map of veterinary clinics/).getAttribute('src')).toContain(
      '7.29%2C80.63',
    );
    expect(screen.getAllByRole('link', { name: /Directions/ })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/dir/'),
    );
  });
});
