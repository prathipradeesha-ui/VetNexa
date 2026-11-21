import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderRoute, signedOut } from '../../test/render';
import type { ClinicSummary } from '../clinics/useClinics';
import { dangerResult } from './DangerSignCheck';
import {
  loadSavedClinics,
  refreshSavedClinics,
  SAVED_CLINICS_KEY,
  saveClinics,
} from './savedClinics';

const clinic: ClinicSummary = {
  id: '2',
  slug: 'colombo-24h',
  name: 'Colombo 24h Animal Hospital',
  addressLine: '1 Main Street',
  city: 'Colombo',
  district: 'Colombo',
  latitude: 6.91,
  longitude: 79.86,
  phone: '0112345678',
  services: ['Emergency care'],
  hasEmergency: true,
  isOpen24Hours: true,
  isOpenNow: true,
  averageRating: 4.5,
  reviewCount: 2,
  imageUrl: null,
};
const clinicsUrl = 'GET /api/clinics?emergency=true';

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('saved emergency clinic list', () => {
  it('keeps only public details and leaves out "open now", which goes out of date', () => {
    saveClinics([clinic], new Date('2026-11-21T10:00:00Z'));
    const saved = loadSavedClinics()!;
    expect(saved.savedAt).toBe('2026-11-21T10:00:00.000Z');
    expect(saved.clinics[0]).toEqual({
      id: '2',
      slug: 'colombo-24h',
      name: 'Colombo 24h Animal Hospital',
      addressLine: '1 Main Street',
      city: 'Colombo',
      latitude: 6.91,
      longitude: 79.86,
      phone: '0112345678',
      isOpen24Hours: true,
    });
  });

  it('ignores a damaged saved list', () => {
    localStorage.setItem(SAVED_CLINICS_KEY, '{not json');
    expect(loadSavedClinics()).toBeNull();
  });

  it('refreshes in the background only when the saved list is old', async () => {
    const fetchMock = mockApi({ [clinicsUrl]: { status: 200, body: { clinics: [clinic] } } });
    const now = new Date('2026-11-21T10:00:00Z');
    await refreshSavedClinics(now);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await refreshSavedClinics(new Date('2026-11-21T15:00:00Z')); // 5 hours later
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await refreshSavedClinics(new Date('2026-11-22T10:00:00Z')); // next day
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not try to refresh while offline', async () => {
    const fetchMock = mockApi({});
    goOffline();
    await refreshSavedClinics();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('danger-sign rule', () => {
  it('sends any danger sign straight to a vet, and never says no signs means fine', () => {
    expect(dangerResult(['seizure'])).toBe('go-now');
    expect(dangerResult(['heavy_bleeding', 'collapse'])).toBe('go-now');
    expect(dangerResult([])).toBe('see-vet');
  });
});

describe('emergency page offline', () => {
  it('saves the clinic list while online', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'GET /api/emergency/status': { status: 200, body: { available: true, demoModel: true } },
      [clinicsUrl]: { status: 200, body: { clinics: [clinic], total: 1, facets: {} } },
    });
    renderRoute('/emergency');
    await screen.findAllByText('Colombo 24h Animal Hospital');
    expect(loadSavedClinics()?.clinics[0]?.phone).toBe('0112345678');
  });

  it('shows the saved clinics with call buttons and the danger-sign check', async () => {
    saveClinics([clinic], new Date('2026-11-20T08:30:00Z'));
    mockApi({}); // every request fails, as it does with no connection
    goOffline();
    renderRoute('/emergency');

    const clinics = (await screen.findByRole('heading', { name: /Emergency clinics/ })).closest(
      'section',
    )!;
    expect(
      await within(clinics).findByText(/This is the clinic list saved on this phone/),
    ).toBeInTheDocument();
    expect(within(clinics).getByRole('link', { name: 'Call' })).toHaveAttribute(
      'href',
      'tel:0112345678',
    );
    expect(within(clinics).queryByLabelText('Map of emergency clinics')).not.toBeInTheDocument();

    const wound = screen.getByRole('heading', { name: /Check a wound/ }).closest('section')!;
    expect(wound).toHaveTextContent('The photo check needs an internet connection');
    expect(within(wound).queryByLabelText('Photo of the wound or skin')).not.toBeInTheDocument();

    await userEvent.click(within(wound).getByRole('checkbox', { name: /Seizure/ }));
    await userEvent.click(within(wound).getByRole('button', { name: 'Check danger signs' }));
    expect(
      within(wound).getByRole('heading', { name: 'Go to a veterinarian now' }),
    ).toBeInTheDocument();
  });

  it('says a vet should still check it when there are no danger signs', async () => {
    mockApi({});
    goOffline();
    renderRoute('/emergency');

    const wound = (await screen.findByRole('heading', { name: /Check a wound/ })).closest(
      'section',
    )!;
    await userEvent.click(within(wound).getByRole('button', { name: 'Check danger signs' }));
    expect(
      within(wound).getByRole('heading', {
        name: /No danger signs, but a vet should still check it/,
      }),
    ).toBeInTheDocument();
  });

  it('explains when no clinic list has been saved yet', async () => {
    mockApi({});
    goOffline();
    renderRoute('/emergency');
    expect(
      await screen.findByText(/no clinic list has been saved on this phone yet/),
    ).toBeInTheDocument();
  });
});
