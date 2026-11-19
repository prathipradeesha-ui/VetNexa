import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../router';

/** Renders the real app routes at the given URL, with a fresh React Query cache. */
export function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

type MockResponse = { status: number; body?: unknown };

/**
 * Replaces fetch with a fake API. `handlers` maps "METHOD /path" to a response, e.g.
 *   mockApi({ 'GET /api/auth/me': { status: 401, body: { error: {...} } } })
 * Returns the mock so tests can inspect the requests that were sent.
 */
export function mockApi(handlers: Record<string, MockResponse | (() => MockResponse)>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const { status, body } = typeof handler === 'function' ? handler() : handler;
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const signedOut = {
  status: 401,
  body: { error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' } },
};

export const demoOwner = {
  id: 'user-1',
  email: 'nimali.perera@example.com',
  firstName: 'Nimali',
  lastName: 'Perera',
  fullName: 'Nimali Perera',
  phone: '0771234567',
  role: 'OWNER',
  status: 'ACTIVE',
  city: 'Colombo',
  avatarUrl: null,
  createdAt: '2026-01-15T10:00:00.000Z',
  vetProfile: null,
};
