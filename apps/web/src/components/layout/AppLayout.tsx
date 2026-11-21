import { ROLE_LABELS, type UserRole } from '@vetnexa/shared';
import {
  CalendarDays,
  HandHeart,
  HeartHandshake,
  Megaphone,
  Globe,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  MessageCircleQuestion,
  Menu,
  PawPrint,
  ScanSearch,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useCurrentUser, useLogout } from '../../features/auth/useAuth';
import { Logo } from '../brand/Logo';
import './app-layout.css';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Roles that see this item; all roles when omitted. */
  roles?: UserRole[];
}

/** Sidebar items. Each module adds its entry here, with the roles that may see it. */
const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/pets', label: 'My pets', icon: PawPrint, roles: ['OWNER'] },
  { to: '/dashboard/assessments', label: 'Wound check', icon: ScanSearch, roles: ['OWNER'] },
  {
    to: '/dashboard/consultations',
    label: 'Consultations',
    icon: CalendarDays,
    roles: ['OWNER', 'VET'],
  },
  {
    to: '/dashboard/applications',
    label: 'Adoption applications',
    icon: HeartHandshake,
    roles: ['OWNER'],
  },
  { to: '/dashboard/rescue', label: 'Rescue', icon: Megaphone },
  { to: '/dashboard/assistant', label: 'Ask VetNexa', icon: MessageCircleQuestion },
  { to: '/dashboard/admin', label: 'Administration', icon: ShieldCheck, roles: ['ADMIN'] },
  {
    to: '/dashboard/listings',
    label: 'Adoption listings',
    icon: HandHeart,
    roles: ['RESCUER', 'ADMIN'],
  },
];

/**
 * Shell for signed-in pages: a navy sidebar on desktop that becomes a slide-in drawer
 * on phones and tablets.
 */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const signOut = () =>
    logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });

  if (!user) return null; // ProtectedRoute guarantees a user; this satisfies TypeScript.

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="app-topbar">
        <button
          type="button"
          className="app-topbar__menu"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} />
        </button>
        <Link to="/dashboard" aria-label="VetNexa dashboard">
          <Logo />
        </Link>
      </header>

      {drawerOpen && (
        <div className="app-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="app-sidebar"
        className={`app-sidebar ${drawerOpen ? 'app-sidebar--open' : ''}`}
        aria-label="Dashboard navigation"
      >
        <div className="app-sidebar__top">
          <Link to="/dashboard" className="app-sidebar__logo" aria-label="VetNexa dashboard">
            <Logo variant="reversed" />
          </Link>
          <button
            type="button"
            className="app-sidebar__close"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="app-nav">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user.role))
            .map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="app-nav__link"
                onClick={() => setDrawerOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          <Link to="/" className="app-nav__link">
            <Globe size={19} aria-hidden="true" />
            Public website
          </Link>
        </nav>

        <div className="app-user">
          <span className="app-user__avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="app-user__info">
            <strong>{user.fullName}</strong>
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
          <button
            type="button"
            className="app-user__logout"
            onClick={signOut}
            disabled={logout.isPending}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
