import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router';
import { Button } from '../../components/ui/Button';
import type { Paged } from './useAdmin';

const SECTIONS = [
  { to: '/dashboard/admin', label: 'Statistics', end: true },
  { to: '/dashboard/admin/users', label: 'Users' },
  { to: '/dashboard/admin/vets', label: 'Vet verification' },
  { to: '/dashboard/admin/clinics', label: 'Clinics' },
  { to: '/dashboard/admin/reviews', label: 'Reviews' },
  { to: '/dashboard/admin/messages', label: 'Messages' },
];

/** Page heading plus tabs linking the administration sections. */
export function AdminHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </div>
      <nav className="tabs" aria-label="Administration sections">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            end={section.end}
            className={({ isActive }) => `tabs__tab${isActive ? ' tabs__tab--active' : ''}`}
          >
            {section.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function Pagination({ info, onPage }: { info: Paged; onPage: (page: number) => void }) {
  if (info.pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pages">
      <Button
        variant="secondary"
        size="sm"
        disabled={info.page <= 1}
        onClick={() => onPage(info.page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </Button>
      <span>
        Page {info.page} of {info.pages} · {info.total} in total
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={info.page >= info.pages}
        onClick={() => onPage(info.page + 1)}
      >
        Next <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
export const formatDay = (iso: string) => dateFormat.format(new Date(iso));
