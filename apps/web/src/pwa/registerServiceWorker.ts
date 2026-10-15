// Registers the service worker vite-plugin-pwa generates and brings each deploy to an open page (cac-eno, amending
// phase 4 D12). The worker skips waiting and claims clients (vite.config.ts), so a new one takes over as soon as it has
// installed rather than when every window of the app has closed, which an installed app on Android rarely does. This
// module asks for an update whenever the app comes back to the foreground, and notes when a newer worker takes over;
// the page then reloads at the next screen change (ReloadOnUpdate.tsx), never on the screen in use, with no prompt.

let updated = false;

/** Whether a newer worker has taken over this page since it loaded, so the page still runs the build before it. */
export function isUpdated(): boolean {
  return updated;
}

/**
 * Calls `onUpdate` when a worker takes over from another. A page that loaded without a worker (the first visit) gains
 * one when the first worker claims it; that is not an update, because the page is already the build that worker holds.
 */
export function watchForUpdate(container: ServiceWorkerContainer, onUpdate: () => void): void {
  let controlled = container.controller !== null;
  container.addEventListener('controllerchange', () => {
    if (controlled) onUpdate();
    controlled = true;
  });
}

export function registerServiceWorker(): void {
  // No worker in `vite dev` (the plugin builds it only for production) or in a browser without service workers.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  watchForUpdate(navigator.serviceWorker, () => {
    updated = true;
  });
  // After load, so the first visit's precache downloads do not compete with the page's own requests.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then(
      (registration) => {
        // The browser checks for a new worker when the app is opened, but an installed app resumed from the
        // background loads nothing, so it checks again each time it is shown. Offline, the check fails; that is fine.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
        });
      },
      (error: unknown) => {
        console.error('Service worker registration failed', error);
      },
    );
  });
}
