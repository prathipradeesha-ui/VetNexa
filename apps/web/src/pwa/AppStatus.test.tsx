import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStatus } from './AppStatus';
import { DISMISSED_KEY, isAppleMobile } from './useInstallPrompt';

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

/** A fake install prompt, like the one Chrome and Android send. */
function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('offline banner', () => {
  it('appears when the connection drops and goes away when it returns', () => {
    render(<AppStatus />);
    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();

    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(/You are offline/);

    setOnline(true);
    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();
  });
});

describe('install card', () => {
  it('stays hidden until the browser says the app can be installed', () => {
    render(<AppStatus />);
    expect(screen.queryByText('Install VetNexa')).not.toBeInTheDocument();
  });

  it('opens the browser install prompt from the Install app button', async () => {
    render(<AppStatus />);
    const event = fireInstallPrompt();
    expect(event.defaultPrevented).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Install app/ }));
    expect(event.prompt).toHaveBeenCalled();
    expect(screen.queryByText('Install VetNexa')).not.toBeInTheDocument();
  });

  it('hides the card once the app is installed', () => {
    render(<AppStatus />);
    fireInstallPrompt();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByText('Install VetNexa')).not.toBeInTheDocument();
  });

  it('remembers "Not now" so the card does not keep coming back', async () => {
    const { unmount } = render(<AppStatus />);
    fireInstallPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Install VetNexa')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');

    unmount();
    render(<AppStatus />);
    fireInstallPrompt();
    expect(screen.queryByText('Install VetNexa')).not.toBeInTheDocument();
  });

  it('shows Add to Home Screen steps on iPhone, which has no install prompt', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    );
    render(<AppStatus />);
    expect(screen.getByText('Install VetNexa')).toBeInTheDocument();
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install app/ })).not.toBeInTheDocument();
  });
});

describe('isAppleMobile', () => {
  it('recognises iPhones and iPads but not desktop computers', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true); // iPad
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});
