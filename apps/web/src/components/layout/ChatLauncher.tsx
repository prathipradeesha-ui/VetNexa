import { MessageCircleQuestion, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import './chat-launcher.css';

// The chat code is only downloaded when someone opens the panel.
const AssistantChat = lazy(() =>
  import('../../features/assistant/AssistantPage').then((m) => ({ default: m.AssistantChat })),
);

/** Pages that already show the full assistant do not need the floating button. */
const HIDDEN_ON = ['/assistant', '/dashboard/assistant'];

/**
 * Floating "Ask VetNexa" button in the bottom-right corner that opens the pet-care assistant
 * in a panel (a full-screen sheet on phones). Escape closes it and focus returns to the button.
 */
export function ChatLauncher() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Move focus into the panel when it opens, so keyboard and screen-reader users land there.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (HIDDEN_ON.includes(pathname)) return null;

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          id="chat-launcher-panel"
          className="chat-launcher__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-launcher-title"
          tabIndex={-1}
        >
          <header className="chat-launcher__header">
            <h2 id="chat-launcher-title">
              <MessageCircleQuestion size={20} aria-hidden="true" /> Ask VetNexa
            </h2>
            <Link to="/assistant" className="chat-launcher__full" onClick={() => setOpen(false)}>
              Full page
            </Link>
            <button
              type="button"
              className="chat-launcher__close"
              aria-label="Close the assistant"
              onClick={close}
            >
              <X size={20} />
            </button>
          </header>
          <div className="chat-launcher__body">
            <Suspense fallback={<p className="chat-launcher__loading">Loading the assistant…</p>}>
              <AssistantChat compact />
            </Suspense>
          </div>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`chat-launcher__button${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={open ? 'chat-launcher-panel' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <MessageCircleQuestion size={24} aria-hidden="true" />
        )}
        <span className={open ? 'sr-only' : 'chat-launcher__label'}>
          {open ? 'Close the assistant' : 'Ask VetNexa'}
        </span>
      </button>
    </>
  );
}
