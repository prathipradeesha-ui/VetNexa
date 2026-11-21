import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOwner, mockApi, renderRoute, signedOut } from '../../test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = {
  kind: 'answer',
  text: 'Deworming dogs and cats: …',
  emergency: null,
  article: {
    id: 'deworming',
    title: 'Deworming dogs and cats',
    category: 'Prevention',
    urgency: 'routine',
    species: ['dog', 'cat'],
    summary: 'Intestinal worms are very common in puppies and kittens.',
    sections: [
      { heading: 'Typical schedule', text: '', items: ['Adults: at least every 3 months.'] },
    ],
    sources: ['ESCCAP guidelines'],
  },
  related: [
    { id: 'fleas-and-ticks', title: 'Fleas and ticks', question: 'How can I prevent fleas?' },
  ],
  suggestions: [],
  actions: [{ label: 'Find a clinic', href: '/clinics' }],
  score: 0.3,
  disclaimer: 'General information only, not veterinary advice.',
};

const emergency = {
  ...answer,
  kind: 'emergency',
  text: 'This sounds like it could be an emergency (possible poisoning).',
  emergency: { reason: 'possible poisoning', steps: ['Contact or go to a veterinary clinic now.'] },
  article: null,
  related: [],
  actions: [{ label: 'Find an emergency clinic', href: '/clinics?emergency=true' }],
};

describe('pet-care assistant', () => {
  it('lets a visitor ask a question and shows the article answer', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/chat': { status: 200, body: { reply: answer, saved: false } },
    });
    renderRoute('/assistant');

    const input = await screen.findByLabelText('Your question');
    await userEvent.type(input, 'How often should I deworm my dog?{Enter}');

    expect(
      await screen.findByRole('heading', { name: 'Deworming dogs and cats' }),
    ).toBeInTheDocument();
    expect(screen.getByText('How often should I deworm my dog?')).toBeInTheDocument();
    expect(screen.getByText('Adults: at least every 3 months.')).toBeInTheDocument();
    expect(screen.getByText(/Further reading: ESCCAP guidelines/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('log')).getByRole('link', { name: 'Find a clinic' }),
    ).toHaveAttribute('href', '/clinics');
    expect(screen.getByText(/not veterinary advice/)).toBeInTheDocument();
    expect(screen.getByText(/Your questions are not saved/)).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/chat')!;
    expect(JSON.parse(String(init!.body))).toEqual({
      message: 'How often should I deworm my dog?',
    });
  });

  it('sends a suggested question when a chip is clicked', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/chat': { status: 200, body: { reply: answer, saved: false } },
    });
    renderRoute('/assistant');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Which foods are dangerous for cats?' }),
    );
    await screen.findByRole('heading', { name: 'Deworming dogs and cats' });
    expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.anything());
    // The related article is offered as the next question.
    expect(screen.getByRole('button', { name: 'How can I prevent fleas?' })).toBeEnabled();
  });

  it('shows emergencies prominently with a link to emergency clinics', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/chat': { status: 200, body: { reply: emergency, saved: false } },
    });
    renderRoute('/assistant');

    await userEvent.type(await screen.findByLabelText('Your question'), 'my dog ate rat poison');
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Possible emergency/)).toBeInTheDocument();
    expect(within(alert).getByText(/possible poisoning/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find an emergency clinic' })).toHaveAttribute(
      'href',
      '/clinics?emergency=true',
    );
  });

  it('loads a signed-in user’s saved conversation and can clear it', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': { status: 200, body: { user: demoOwner } },
      'GET /api/chat/history': {
        status: 200,
        body: {
          messages: [
            {
              id: 'm1',
              sender: 'USER',
              content: 'Deworming?',
              reply: null,
              createdAt: '2026-11-21T08:00:00Z',
            },
            {
              id: 'm2',
              sender: 'ASSISTANT',
              content: answer.text,
              reply: answer,
              createdAt: '2026-11-21T08:00:00Z',
            },
          ],
        },
      },
      'DELETE /api/chat/history': { status: 204 },
    });
    renderRoute('/dashboard/assistant');

    expect(await screen.findByText('Deworming?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deworming dogs and cats' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Clear conversation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/I answer general questions/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/history',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('explains when the assistant is unavailable', async () => {
    mockApi({
      'GET /api/auth/me': signedOut,
      'POST /api/chat': {
        status: 503,
        body: {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'The pet-care assistant is not available right now.',
          },
        },
      },
    });
    renderRoute('/assistant');

    await userEvent.type(await screen.findByLabelText('Your question'), 'hello{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('not available right now');
  });
});
