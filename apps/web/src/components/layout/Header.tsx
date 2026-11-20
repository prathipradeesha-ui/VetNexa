import { LayoutDashboard, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useCurrentUser } from '../../features/auth/useAuth';
import { Logo } from '../brand/Logo';

export const publicNavLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/clinics', label: 'Find a clinic' },
  { to: '/adopt', label: 'Adopt' },
  { to: '/about', label: 'About us' },
  { to: '/contact', label: 'Contact' },
];

/**
 * Site header. On small screens the navigation collapses into a menu button that opens
 * a full-width panel that closes when a link is chosen or Escape is pressed.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const closeMenu = () => setMenuOpen(false);

  // Allow closing the mobile menu with the Escape key.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const accountActions = user ? (
    <Link to="/dashboard" className="btn btn--primary btn--sm">
      <LayoutDashboard size={16} aria-hidden="true" /> My dashboard
    </Link>
  ) : (
    <>
      <Link to="/login" className="btn btn--ghost btn--sm">
        Sign in
      </Link>
      <Link to="/register" className="btn btn--primary btn--sm">
        Create account
      </Link>
    </>
  );

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="VetNexa home">
          <Logo />
        </Link>

        <nav className="site-nav" aria-label="Main">
          {publicNavLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="site-nav__link">
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header__actions">{accountActions}</div>

        <button
          type="button"
          className="site-header__menu-btn"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="mobile-menu">
          <nav aria-label="Mobile">
            {publicNavLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className="mobile-menu__link"
                onClick={closeMenu}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mobile-menu__actions" onClick={closeMenu}>
            {accountActions}
          </div>
        </div>
      )}
    </header>
  );
}
