import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../pwa/useOnlineStatus';
import { listPending, sendPendingReports, type SentReport } from './pendingReports';
import { postGuestRescueReport } from './useEmergency';

const RETRY_MS = 60_000;

/**
 * Sends rescue reports that were saved on the phone while offline: when the app opens, when the
 * connection comes back, and every minute while some are still waiting.
 */
export function usePendingReportSender() {
  const online = useOnlineStatus();
  const [sent, setSent] = useState<SentReport[]>([]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    const trySend = () => {
      if (listPending().length === 0) return;
      void sendPendingReports(postGuestRescueReport).then((reports) => {
        if (active && reports.length > 0) setSent((current) => [...current, ...reports]);
      });
    };
    trySend();
    const timer = window.setInterval(trySend, RETRY_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [online]);

  return { sent, clear: () => setSent([]) };
}
