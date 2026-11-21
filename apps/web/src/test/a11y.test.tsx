import axe from 'axe-core';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from './render';

/*
 * Automated accessibility check (WCAG 2.2 A and AA rules from axe-core) for the main public
 * pages, so problems are caught in CI. Colour contrast cannot be measured in this test browser;
 * it was checked page by page in a real browser during the Stage 25 review.
 */

/** Answers every API call: signed out, with empty lists, like a fresh installation. */
function emptyApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/auth/me')) {
        return Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Sign in' } },
          { status: 401 },
        );
      }
      if (url.startsWith('/api/emergency/status')) {
        return Response.json({ available: true, demoModel: true, modelVersion: 'test' });
      }
      return Response.json({
        clinics: [],
        listings: [],
        total: 0,
        facets: { cities: [], services: [] },
        messages: [],
      });
    }),
  );
}

async function violations() {
  const result = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('accessibility', () => {
  it.each([
    ['home', '/', /dog and cat/i],
    ['about', '/about', /connecting everyone/i],
    ['clinic directory', '/clinics', /clinic/i],
    ['adoption', '/adopt', /adopt|home/i],
    ['emergency help', '/emergency', /in danger/i],
    ['contact', '/contact', /here to help/i],
    ['sign in', '/login', /sign in|welcome back/i],
    ['create account', '/register', /create/i],
    ['page not found', '/no-such-page', /could not find/i],
  ])('the %s page has no WCAG A or AA problems', async (_name, path, heading) => {
    emptyApi();
    renderRoute(path);
    await screen.findByRole('heading', { level: 1, name: heading });
    expect(await violations()).toEqual([]);
  });
});
