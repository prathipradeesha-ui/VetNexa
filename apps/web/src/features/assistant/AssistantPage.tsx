import { CHAT_MAX_CHARS } from '@vetnexa/shared';
import { Bot, SendHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/PageLoader';
import { EmergencyNotice } from '../assessments/AssessmentBits';
import { useCurrentUser } from '../auth/useAuth';
import { ChatReplyCard } from './ChatReplyCard';
import { useChat } from './useChat';
import '../../pages/pages.css';
import '../assessments/assessments.css';
import './assistant.css';

const STARTERS = [
  'When should my puppy be vaccinated?',
  'Which foods are dangerous for cats?',
  'How do I remove a tick from my dog?',
  'My cat keeps sneezing',
];

/** The chat itself; `compact` is the version shown in the floating panel. */
export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const { data: user, isPending: checkingUser } = useCurrentUser();
  const signedIn = Boolean(user);
  const chat = useChat(signedIn);
  const { messages, send, clear } = chat;
  // Until we know who is signed in, we do not know whether there is a saved conversation.
  const loadingHistory = checkingUser || chat.loadingHistory;
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the conversation box (not the whole page) to the newest message.
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, send.isPending]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
    setDraft('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };

  // Enter sends; Shift+Enter starts a new line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask(draft);
    }
  };

  return (
    <div className={compact ? 'chat chat--compact' : 'chat'}>
      {!compact && <EmergencyNotice />}

      <div className="card chat-window">
        {/* Screen readers: answers use level-3 headings, so give the conversation a level 2. */}
        {!compact && <h2 className="sr-only">Conversation</h2>}
        <div
          ref={logRef}
          className="chat-log"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {loadingHistory && <PageLoader label="Loading your conversation…" />}

          {!loadingHistory && messages.length === 0 && (
            <div className="chat-welcome">
              <Bot size={32} aria-hidden="true" />
              <p>
                Hi! I answer general questions about caring for dogs and cats, from a written
                pet-care knowledge base. I can't examine your pet or diagnose illness.
              </p>
              <div className="chat-followups" aria-label="Example questions">
                {STARTERS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="chat-chip"
                    onClick={() => ask(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) =>
            message.sender === 'USER' ? (
              <div key={message.id} className="chat-bubble chat-bubble--user">
                <span className="sr-only">You asked: </span>
                {message.content}
              </div>
            ) : (
              <div key={message.id} className="chat-bubble chat-bubble--assistant">
                <span className="sr-only">VetNexa assistant: </span>
                {message.reply ? (
                  <ChatReplyCard
                    reply={message.reply}
                    onAsk={ask}
                    // Only the latest answer offers clickable follow-ups while a reply is loading.
                    disabled={send.isPending || index !== messages.length - 1}
                  />
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            ),
          )}

          {send.isPending && (
            <div className="chat-bubble chat-bubble--assistant chat-typing" aria-label="Thinking">
              <span />
              <span />
              <span />
            </div>
          )}
          {send.isError && <Alert tone="error">{send.error.message}</Alert>}
        </div>

        <form className="chat-composer" onSubmit={onSubmit}>
          <label htmlFor="chat-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="chat-input"
            className="textarea"
            rows={2}
            maxLength={CHAT_MAX_CHARS}
            placeholder="Ask about vaccinations, parasites, feeding, symptoms…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            type="submit"
            aria-label="Send question"
            disabled={!draft.trim() || send.isPending}
          >
            <SendHorizontal size={18} aria-hidden="true" />
          </Button>
        </form>
      </div>

      <div className="chat-footer">
        {signedIn ? (
          confirmClear ? (
            <span className="chat-footer__confirm">
              Delete your saved conversation?
              <Button size="sm" variant="secondary" onClick={() => setConfirmClear(false)}>
                Keep it
              </Button>
              <Button
                size="sm"
                className="btn--danger"
                loading={clear.isPending}
                loadingText="Deleting…"
                onClick={() => clear.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
              >
                Delete
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0}
            >
              <Trash2 size={16} aria-hidden="true" /> Clear conversation
            </Button>
          )
        ) : (
          <span>
            Your questions are not saved. <Link to="/login">Sign in</Link> to keep your
            conversation.
          </span>
        )}
        <span>Answers come from a pet-care knowledge base pending veterinary review.</span>
      </div>
    </div>
  );
}

/** Public page: /assistant */
export function AssistantPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Pet-care assistant</span>
          <h1>Ask VetNexa</h1>
          <p className="lead">
            Quick, trustworthy answers to everyday questions about your dog or cat, with a clear
            nudge to the vet when it matters.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow">
          <AssistantChat />
        </div>
      </section>
    </>
  );
}

/** Same assistant inside the dashboard: /dashboard/assistant */
export function DashboardAssistantPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Ask VetNexa</h1>
          <p>General answers about caring for dogs and cats.</p>
        </div>
      </div>
      <AssistantChat />
    </>
  );
}
