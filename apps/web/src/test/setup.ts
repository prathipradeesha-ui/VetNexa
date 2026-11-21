import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Page tests load lazy pages and wait for several requests. When the whole suite runs in
// parallel the default one-second wait is too short and tests fail at random, so allow longer.
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement scrolling; the router calls it on navigation.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

afterEach(() => {
  cleanup();
});
