import { Link } from 'react-router';
import './pages.css';

export function NotFoundPage() {
  return (
    <section className="container not-found">
      <p className="not-found__code" aria-hidden="true">
        404
      </p>
      <h1>We could not find that page</h1>
      <p className="muted">The link may be out of date, or the page may have moved.</p>
      <Link to="/" className="btn btn--primary">
        Back to the home page
      </Link>
    </section>
  );
}
