import { Download, Share, WifiOff, X } from 'lucide-react';
import { useInstallPrompt } from './useInstallPrompt';
import { useOnlineStatus } from './useOnlineStatus';
import './pwa.css';

/**
 * Connection and install messages shown on every page: a banner while offline, and a small
 * card offering to install VetNexa on the phone or computer.
 */
export function AppStatus() {
  const online = useOnlineStatus();
  const { option, install, dismiss } = useInstallPrompt();

  return (
    <>
      <div role="status" aria-live="polite" className="offline-banner-region">
        {!online && (
          <p className="offline-banner">
            <WifiOff size={18} aria-hidden="true" />
            <span>
              You are offline. Clinics, wound checks and records need a connection. In an emergency,
              phone your vet directly.
            </span>
          </p>
        )}
      </div>

      {option && (
        <aside className="install-card" aria-labelledby="install-card-title">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} />
          <div className="install-card__body">
            <p id="install-card-title" className="install-card__title">
              Install VetNexa
            </p>
            {option === 'prompt' ? (
              <>
                <p className="install-card__text">
                  Open emergency help, clinics and wound checks from your home screen.
                </p>
                <button type="button" className="btn btn--primary btn--sm" onClick={install}>
                  <Download size={16} aria-hidden="true" /> Install app
                </button>
              </>
            ) : (
              <p className="install-card__text">
                Tap <Share size={14} aria-hidden="true" /> <strong>Share</strong>, then{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            )}
          </div>
          <button
            type="button"
            className="install-card__close"
            aria-label="Not now"
            onClick={dismiss}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      )}
    </>
  );
}
