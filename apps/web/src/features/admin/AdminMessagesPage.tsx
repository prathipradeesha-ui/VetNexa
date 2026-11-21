import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUSES,
  CONTACT_TOPIC_LABELS,
  type ContactStatus,
} from '@vetnexa/shared';
import { Mail, Phone } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { PageLoader } from '../../components/ui/PageLoader';
import { AdminHeader, formatDay, Pagination } from './AdminBits';
import { useAdminMessages, useSetMessageStatus, type AdminMessage } from './useAdmin';
import './admin.css';

const STATUS_TONE: Record<ContactStatus, string> = {
  NEW: 'badge badge--warning',
  IN_PROGRESS: 'badge badge--info',
  RESOLVED: 'badge',
};

function MessageItem({ message }: { message: AdminMessage }) {
  const setStatus = useSetMessageStatus();
  return (
    <li className="admin-item">
      <div className="admin-item__head">
        <div>
          <strong>{message.name}</strong>
          <span className="admin-sub">
            {CONTACT_TOPIC_LABELS[message.topic]} · {formatDay(message.createdAt)}
            {message.userId && ' · signed-in user'}
          </span>
        </div>
        <span className={STATUS_TONE[message.status]}>{CONTACT_STATUS_LABELS[message.status]}</span>
      </div>
      <p className="pre-line">{message.message}</p>
      <div className="admin-item__contact">
        <a href={`mailto:${message.email}`}>
          <Mail size={14} aria-hidden="true" /> {message.email}
        </a>
        {message.phone && (
          <a href={`tel:${message.phone}`}>
            <Phone size={14} aria-hidden="true" /> {message.phone}
          </a>
        )}
      </div>
      <div className="admin-actions">
        <label htmlFor={`status-${message.id}`} className="admin-sub">
          Status
        </label>
        <select
          id={`status-${message.id}`}
          className="select select--sm"
          value={message.status}
          disabled={setStatus.isPending}
          onChange={(event) =>
            setStatus.mutate({ id: message.id, status: event.target.value as ContactStatus })
          }
        >
          {CONTACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTACT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        {setStatus.isError && <Alert tone="error">{setStatus.error.message}</Alert>}
      </div>
    </li>
  );
}

export function AdminMessagesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'NEW';
  const page = Number(params.get('page') ?? 1) || 1;
  const messages = useAdminMessages({ status: status === 'ALL' ? undefined : status, page });

  return (
    <>
      <AdminHeader title="Messages" intro="Messages sent through the Contact page." />
      <div className="chip-filters" role="group" aria-label="Filter messages">
        {[...CONTACT_STATUSES, 'ALL' as const].map((value) => (
          <button
            key={value}
            type="button"
            className="toggle-chip"
            aria-pressed={status === value}
            onClick={() => setParams({ status: value })}
          >
            {value === 'ALL' ? 'All' : CONTACT_STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      <div className="card">
        {messages.isPending && <PageLoader label="Loading messages…" />}
        {messages.isError && <Alert tone="error">{messages.error.message}</Alert>}
        {messages.isSuccess && messages.data.messages.length === 0 && (
          <div className="empty-state">
            <p>No messages here.</p>
          </div>
        )}
        {messages.isSuccess && messages.data.messages.length > 0 && (
          <ul className="admin-list">
            {messages.data.messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </ul>
        )}
      </div>
      {messages.isSuccess && (
        <Pagination info={messages.data} onPage={(n) => setParams({ status, page: String(n) })} />
      )}
    </>
  );
}
