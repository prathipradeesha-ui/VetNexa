import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute, signedOut } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('protected routes', () => {
  it('sends signed-out visitors to the login page', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    const { router } = renderRoute('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the dashboard to a signed-in user', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { user: demoOwner } } });
    renderRoute('/dashboard');

    expect(await screen.findByRole('heading', { name: /Nimali$/ })).toBeInTheDocument();
    expect(screen.getByText('nimali.perera@example.com')).toBeInTheDocument();
  });
});

describe('login page', () => {
  it('validates the form before calling the API', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/login', expect.anything());
  });

  it('shows the API error when the password is wrong', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'Incorrect email or password' } },
      },
    });
    renderRoute('/login');

    await userEvent.type(await screen.findByLabelText('Email address'), 'owner@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });

  it('signs in and opens the dashboard', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/login': { status: 200, body: { user: demoOwner } },
    });
    const { router } = renderRoute('/login');

    await userEvent.type(await screen.findByLabelText('Email address'), demoOwner.email);
    await userEvent.type(screen.getByLabelText('Password'), 'Secure123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(await screen.findByText(demoOwner.email)).toBeInTheDocument();
  });
});

describe('registration page', () => {
  it('asks for a licence number only when registering as a veterinarian', async () => {
    mockApi({ 'GET /api/auth/me': signedOut });
    renderRoute('/register');

    await screen.findByRole('heading', { name: 'Create your account' });
    expect(screen.queryByLabelText('Licence number')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Veterinarian/ }));

    expect(screen.getByLabelText('Licence number')).toBeInTheDocument();
  });

  it('shows a server conflict next to the email field', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/auth/register': {
        status: 409,
        body: {
          error: {
            code: 'CONFLICT',
            message: 'An account with this email already exists',
            details: [{ field: 'email', message: 'An account with this email already exists' }],
          },
        },
      },
    });
    renderRoute('/register');

    await userEvent.type(await screen.findByLabelText('First name'), 'Nimali');
    await userEvent.type(screen.getByLabelText('Last name'), 'Perera');
    await userEvent.type(screen.getByLabelText('Email address'), demoOwner.email);
    await userEvent.type(screen.getByLabelText('Password'), 'Secure123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Secure123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const emailInput = screen.getByLabelText('Email address');
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));
    expect(emailInput).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // not duplicated at the top
  });
});
