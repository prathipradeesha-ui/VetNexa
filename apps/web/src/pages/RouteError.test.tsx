import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLoadError, RouteError } from './RouteError';

function renderFailingPage(error: Error) {
  const router = createMemoryRouter([
    {
      path: '/',
      errorElement: <RouteError />,
      Component: () => {
        throw error;
      },
    },
  ]);
  render(<RouterProvider router={router} />);
}

const loadFailure = new TypeError(
  'Failed to fetch dynamically imported module: http://localhost:5173/src/features/emergency/EmergencyPage.tsx',
);

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('page error screen', () => {
  it('recognises "could not download the page" errors from each browser', () => {
    expect(isLoadError(loadFailure)).toBe(true);
    expect(isLoadError(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(isLoadError(new TypeError('error loading dynamically imported module'))).toBe(true); // Firefox
    expect(isLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('reloads once to fetch the latest version, but never in a loop', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    renderFailingPage(loadFailure);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'This page could not load' })).toBeInTheDocument();

    // Straight after a reload that failed again, it stays on the friendly page instead.
    renderFailingPage(loadFailure);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('offers to try again or open emergency help instead of a raw error', () => {
    renderFailingPage(new Error('Cannot read properties of undefined'));
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Emergency help/ })).toHaveAttribute(
      'href',
      '/emergency',
    );
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  });

  it('mentions that emergency help works offline when there is no connection', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderFailingPage(loadFailure);
    expect(screen.getByText(/Emergency help still works without internet/)).toBeInTheDocument();
  });
});
