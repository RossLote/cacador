import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { isUpdated } from './registerServiceWorker';

const reloadPage = () => window.location.reload();

/**
 * Reloads the page at the next screen change once a newer service worker has taken over (cac-eno), so a deploy reaches
 * an app that stays open for days. Only a change of screen does it, never a change within one: the screen in use is
 * never reloaded, and the page reloads onto the screen just chosen. Renders nothing.
 */
export function ReloadOnUpdate({ reload = reloadPage }: { reload?: () => void }) {
  const { pathname } = useLocation();
  const shown = useRef(pathname);
  useEffect(() => {
    if (pathname === shown.current) return;
    shown.current = pathname;
    if (isUpdated()) reload();
  }, [pathname, reload]);
  return null;
}
