import { CheckCircle2, Download, Share, WifiOff, X } from 'lucide-react';
import { usePendingReportSender } from '../features/emergency/usePendingReports';
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
  const reports = usePendingReportSender();

  return (
    <>
      <div role="status" aria-live="polite" className="offline-banner-region">
        {!online && (
          <p className="offline-banner">
            <WifiOff size={18} aria-hidden="true" />
            <span>
              You are offline. Emergency help still works: saved clinics with call buttons, a
              danger-sign check and first-aid guides. <a href="/emergency">Open emergency help</a>
            </span>
          </p>
        )}
        {reports.sent.length > 0 && (
          <div className="sent-banner">
            <CheckCircle2 size={18} aria-hidden="true" />
            <p>
              {reports.sent.map((report) => (
                <span key={report.reference}>
                  Your saved rescue report “{report.title}” has been sent. Reference{' '}
                  <strong>{report.reference}</strong>.{' '}
                </span>
              ))}
            </p>
            <button
              type="button"
              className="sent-banner__close"
              aria-label="Close message"
              onClick={reports.clear}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
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
