import type { GuestRescueReportData } from '@vetnexa/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { AppStatus } from '../../pwa/AppStatus';
import { mockApi, renderRoute, signedOut } from '../../test/render';
import { listPending, queueReport, sendPendingReports, shouldRetry } from './pendingReports';

const report = (title: string) =>
  ({
    species: 'CAT',
    urgency: 'HIGH',
    title,
    description: 'A small kitten is crying in the drain and cannot climb out.',
    locationText: 'Galle Road, post office',
    city: 'Moratuwa',
    latitude: undefined,
    longitude: undefined,
    reporterName: 'Kamal',
    contactPhone: '0771234567',
  }) as GuestRescueReportData;

const offline = new ApiError(0, 'NETWORK_ERROR', 'Cannot reach VetNexa');

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('rescue reports saved for later', () => {
  it('retries only when the problem should pass', () => {
    expect(shouldRetry(offline)).toBe(true);
    expect(shouldRetry(new ApiError(503, 'UNAVAILABLE', 'Down'))).toBe(true);
    expect(shouldRetry(new ApiError(429, 'TOO_MANY_REQUESTS', 'Slow down'))).toBe(true);
    expect(shouldRetry(new ApiError(400, 'VALIDATION_ERROR', 'Bad'))).toBe(false);
  });

  it('sends waiting reports in order and removes them from the phone', async () => {
    queueReport(report('First'));
    queueReport(report('Second'));
    const send = vi
      .fn()
      .mockResolvedValueOnce({ reference: 'AAA111' })
      .mockResolvedValueOnce({ reference: 'BBB222' });

    const sent = await sendPendingReports(send);
    expect(sent).toEqual([
      { title: 'First', reference: 'AAA111' },
      { title: 'Second', reference: 'BBB222' },
    ]);
    expect(listPending()).toEqual([]);
  });

  it('keeps reports when there is still no connection', async () => {
    queueReport(report('First'));
    queueReport(report('Second'));
    const send = vi.fn().mockRejectedValue(offline);

    expect(await sendPendingReports(send)).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1); // stops at the first failure
    expect(listPending().map((item) => item.data.title)).toEqual(['First', 'Second']);
  });

  it('drops a report the server rejects for good', async () => {
    queueReport(report('Broken'));
    const send = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Bad'));
    await sendPendingReports(send);
    expect(listPending()).toEqual([]);
  });

  it('never sends a report twice when two sends start together', async () => {
    queueReport(report('Only once'));
    const send = vi.fn().mockResolvedValue({ reference: 'CCC333' });
    await Promise.all([sendPendingReports(send), sendPendingReports(send)]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps at most five reports on the phone', () => {
    for (let i = 0; i < 5; i += 1) expect(queueReport(report(`Report ${i}`))).toBe(true);
    expect(queueReport(report('One too many'))).toBe(false);
  });
});

describe('rescue form without a connection', () => {
  it('saves the report on the phone instead of failing', async () => {
    mockApi({}); // no request gets through
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
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

    expect(await form.findByText(/Saved on this phone/)).toBeInTheDocument();
    expect(listPending().map((item) => item.data.title)).toEqual(['Kitten trapped in a drain']);
  });

  it('sends saved reports once back online and shows the reference', async () => {
    queueReport(report('Kitten trapped in a drain'));
    const fetchMock = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/emergency/rescue': {
        status: 201,
        body: { report: { reference: 'AB12CD34', createdAt: '2026-11-21T10:00:00Z' } },
      },
    });
    render(<AppStatus />);

    expect(await screen.findByText('AB12CD34')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Kitten trapped in a drain');
    expect(fetchMock).toHaveBeenCalledWith('/api/emergency/rescue', expect.anything());
    expect(listPending()).toEqual([]);
  });
});
