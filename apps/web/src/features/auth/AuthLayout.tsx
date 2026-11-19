import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '../../components/brand/Logo';
import './auth.css';

const benefits = [
  'All vaccinations, treatments and vet visits in one timeline',
  'Reminders before vaccinations and medication are due',
  'AI-supported first guidance when your pet is hurt',
  'Verified veterinarians and honest clinic reviews',
];

/** Two-panel layout for sign-in and sign-up: brand panel on the left, form on the right. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth__brand">
        <Link to="/" className="auth__logo" aria-label="VetNexa home">
          <LogoMark size={44} variant="reversed" />
          <span>
            Vet<span className="auth__logo-accent">Nexa</span>
          </span>
        </Link>
        <div className="auth__pitch">
          <h2>Pet healthcare, connected.</h2>
          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <CheckCircle2 size={20} aria-hidden="true" /> {benefit}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth__tagline">Care · Connect · Protect</p>
      </aside>

      <main className="auth__main" id="main">
        <Link to="/" className="auth__mobile-logo" aria-label="VetNexa home">
          <LogoMark size={40} />
          <span>
            Vet<span className="auth__logo-accent">Nexa</span>
          </span>
        </Link>
        <div className="auth__form">
          <h1>{title}</h1>
          <p className="muted auth__subtitle">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
