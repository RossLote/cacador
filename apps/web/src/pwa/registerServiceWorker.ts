// Registers the service worker vite-plugin-pwa generates (phase 4 D12). The update story is the browser's own: a new
// worker installs in the background and waits, and takes over on the next cold open of the app. So this module never
// listens for an update, never posts SKIP_WAITING and never reloads the page, and the worker has no skipWaiting and no
// clientsClaim (vite.config.ts): a screen in use is never reloaded and no prompt is shown.
export function registerServiceWorker(): void {
  // No worker in `vite dev` (the plugin builds it only for production) or in a browser without service workers.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  // After load, so the first visit's precache downloads do not compete with the page's own requests.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });
  });
}
