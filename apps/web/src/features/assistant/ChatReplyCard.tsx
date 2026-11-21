import type { ChatArticle, ChatReply } from '@vetnexa/shared';
import { BookOpen, Siren } from 'lucide-react';
import { Link } from 'react-router';

const URGENCY = {
  routine: null,
  'see-vet': { label: 'Vet advice recommended', tone: 'badge badge--warning' },
  emergency: { label: 'Can be an emergency', tone: 'badge badge--danger' },
} as const;

function ArticleBody({ article }: { article: ChatArticle }) {
  const urgency = URGENCY[article.urgency];
  return (
    <div className="chat-article">
      <div className="chat-article__head">
        <h3>{article.title}</h3>
        <span className="chat-article__badges">
          <span className="badge badge--neutral">{article.category}</span>
          {urgency && <span className={urgency.tone}>{urgency.label}</span>}
        </span>
      </div>
      <p>{article.summary}</p>
      {article.sections.map((section) => (
        <section
          key={section.heading}
          className={
            section.heading.toLowerCase().startsWith('get help now')
              ? 'chat-section chat-section--urgent'
              : 'chat-section'
          }
        >
          <h4>{section.heading}</h4>
          {section.text && <p>{section.text}</p>}
          {section.items.length > 0 && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {article.sources.length > 0 && (
        <p className="chat-sources">
          <BookOpen size={14} aria-hidden="true" /> Further reading: {article.sources.join('; ')}
        </p>
      )}
    </div>
  );
}

interface ChatReplyCardProps {
  reply: ChatReply;
  /** Sends a follow-up question (suggestions and related articles). */
  onAsk: (question: string) => void;
  disabled?: boolean;
}

/** Renders one structured reply from the assistant. */
export function ChatReplyCard({ reply, onAsk, disabled }: ChatReplyCardProps) {
  const followUps = [
    ...reply.related.map((r) => r.question),
    ...reply.suggestions.filter((s) => !reply.related.some((r) => r.question === s)),
  ];

  return (
    <div className={`chat-reply chat-reply--${reply.kind}`}>
      {reply.kind === 'emergency' && reply.emergency ? (
        <div className="chat-emergency" role="alert">
          <h3>
            <Siren size={20} aria-hidden="true" /> Possible emergency: contact a vet now
          </h3>
          <p>
            Your message mentions {reply.emergency.reason}. Do not wait for more information online.
          </p>
          <ol>
            {reply.emergency.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : (
        !reply.article && <p>{reply.text}</p>
      )}

      {reply.kind === 'redirect' && reply.article && <p>{reply.text}</p>}
      {reply.article && <ArticleBody article={reply.article} />}

      {reply.actions.length > 0 && (
        <div className="chat-actions">
          {reply.actions.map((action, index) => (
            <Link
              key={action.href}
              to={action.href}
              className={`btn btn--sm ${index === 0 ? 'btn--primary' : 'btn--secondary'}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}

      {followUps.length > 0 && (
        <div className="chat-followups" aria-label="Suggested questions">
          {followUps.map((question) => (
            <button
              key={question}
              type="button"
              className="chat-chip"
              disabled={disabled}
              onClick={() => onAsk(question)}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <p className="chat-disclaimer">{reply.disclaimer}</p>
    </div>
  );
}
