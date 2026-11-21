/**
 * Registers the service worker that lets VetNexa be installed and show first-aid advice
 * offline. Only production builds use it, so development always loads fresh files.
 */
export function registerServiceWorker(
  enabled: boolean = import.meta.env.PROD,
  container: ServiceWorkerContainer | undefined = navigator.serviceWorker,
): void {
  if (!enabled || !container) return;
  const register = () => {
    container.register('/sw.js', { scope: '/' }).catch(() => {
      // The app works without it; installing and the offline page are extras.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
