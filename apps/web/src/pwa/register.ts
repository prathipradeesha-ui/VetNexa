/**
 * Registers the service worker that lets VetNexa be installed and keep emergency help working
 * offline. Only production builds use it, so development always loads fresh files.
 * `onRegistered` runs once it is in place, for work that only matters offline.
 */
export function registerServiceWorker(
  enabled: boolean = import.meta.env.PROD,
  container: ServiceWorkerContainer | undefined = navigator.serviceWorker,
  onRegistered?: () => void,
): void {
  if (!enabled || !container) return;
  const register = () => {
    container
      .register('/sw.js', { scope: '/' })
      .then(() => onRegistered?.())
      .catch(() => {
        // The app works without it; installing and offline help are extras.
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
