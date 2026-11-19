import { Phone, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { site } from '../../config/site';
import { Logo } from '../brand/Logo';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo variant="reversed" />
          <p>{site.description}</p>
          <p className="site-footer__tagline">{site.tagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="site-footer__heading">Platform</h2>
          <ul>
            <li>
              <Link to="/register">Create an account</Link>
            </li>
            <li>
              <Link to="/register?role=VET">Join as a veterinarian</Link>
            </li>
            <li>
              <Link to="/register?role=RESCUER">Join as a rescuer</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="site-footer__heading">Company</h2>
          <ul>
            <li>
              <Link to="/about">About us</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="site-footer__heading">Contact</h2>
          <p className="site-footer__contact">
            {site.owner.name}
            <br />
            <a href={`tel:${site.owner.phoneInternational}`}>
              <Phone size={14} aria-hidden="true" /> {site.owner.phone}
            </a>
          </p>
          <p className="site-footer__note">{site.supportHours}</p>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <p>
          © {year} {site.name}. Developed by {site.owner.name}.
        </p>
        <p className="site-footer__disclaimer">
          <ShieldCheck size={14} aria-hidden="true" />
          AI features provide preliminary guidance only and do not replace a veterinarian.
        </p>
      </div>
    </footer>
  );
}
