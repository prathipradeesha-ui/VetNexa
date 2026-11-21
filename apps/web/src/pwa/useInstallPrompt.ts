import { useCallback, useEffect, useState } from 'react';

/** Chrome, Edge and Android fire this when the app can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const DISMISSED_KEY = 'vetnexa-install-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** True when VetNexa is already running as an installed app. */
export function isInstalled(): boolean {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone and iPad have no install prompt; people add the site from the Share menu instead. */
export function isAppleMobile(
  userAgent: string = navigator.userAgent,
  touchPoints: number = navigator.maxTouchPoints ?? 0,
): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1);
}

export type InstallOption = 'prompt' | 'apple' | null;

/**
 * Whether to offer installing VetNexa, and how: the browser's own prompt, Add to Home Screen
 * steps on Apple devices, or nothing (already installed, dismissed or not supported).
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // Show our own button instead of the browser's mini bar.
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing: the card simply comes back next visit.
    }
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null); // A prompt can only be used once.
    if (outcome === 'dismissed') dismiss();
  }, [promptEvent, dismiss]);

  let option: InstallOption = null;
  if (!installed && !dismissed) {
    if (promptEvent) option = 'prompt';
    else if (isAppleMobile()) option = 'apple';
  }

  return { option, install, dismiss };
}
