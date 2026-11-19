import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute, signedOut } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public layout', () => {
  it('opens and closes the mobile menu, including with Escape', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/');

    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    await userEvent.click(toggle);
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument();
  });

  it('shows sign-in actions to visitors and a dashboard link to signed-in users', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: demoOwner } } });
    renderRoute('/about');

    const header = within(screen.getByRole('banner'));
    expect(await header.findByRole('link', { name: /My dashboard/ })).toBeInTheDocument();
    expect(header.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows the project contact details in the footer', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/');

    const phone = await screen.findByRole('link', { name: /0785503592/ });
    expect(phone).toHaveAttribute('href', 'tel:+94785503592');
  });

  it('shows a helpful 404 page for unknown addresses', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/no-such-page');

    expect(
      await screen.findByRole('heading', { name: 'We could not find that page' }),
    ).toBeInTheDocument();
  });
});
