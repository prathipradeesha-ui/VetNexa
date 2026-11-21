import { RefreshCw, Siren } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { useOnlineStatus } from '../pwa/useOnlineStatus';
import { NotFoundPage } from './NotFoundPage';
import './pages.css';

const RELOAD_KEY = 'vetnexa-reloaded-after-load-error';

/**
 * True when a page's code could not be downloaded: no connection, the server was stopped, or a
 * new version was published and the old file names no longer exist. Each browser words it
 * differently.
 */
export function isLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch|Load failed/i.test(
    message,
  );
}

/** Reload once to pick up the latest version; never loop if the reload fails too. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Shown instead of a page that failed, so people never see a raw error message. */
export function RouteError() {
  const error = useRouteError();
  const online = useOnlineStatus();
  const loadError = isLoadError(error);

  useEffect(() => {
    if (loadError && online) reloadOnce();
    else console.error(error);
  }, [error, loadError, online]);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <section className="container not-found" role="alert">
      <h1>{loadError ? 'This page could not load' : 'Something went wrong'}</h1>
      <p className="muted">
        {!online
          ? 'You seem to be offline. Emergency help still works without internet.'
          : loadError
            ? 'VetNexa may have just been updated, or the connection dropped. Please try again.'
            : 'Sorry, something went wrong on this page. Please try again.'}
      </p>
      <div className="not-found__actions">
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          <RefreshCw size={18} aria-hidden="true" /> Try again
        </button>
        {/* Plain links load the page fresh, which is what is needed after a load error. */}
        <a href="/emergency" className="btn btn--secondary">
          <Siren size={18} aria-hidden="true" /> Emergency help
        </a>
        <a href="/" className="btn btn--ghost">
          Home page
        </a>
      </div>
    </section>
  );
}
