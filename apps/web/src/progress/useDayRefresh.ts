import { useEffect } from 'react';

/** How long from `now` until the next local midnight, ms. */
function untilMidnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/**
 * Calls `refresh` at each local midnight while mounted and whenever the page
 * becomes visible again, so a screen that reads the clock once (Progress's
 * "today" and its 30-day window) follows the date when left open overnight or
 * resumed the next day. `refresh` must keep its identity between renders.
 */
export function useDayRefresh(refresh: () => void): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, untilMidnight(new Date()));
    };
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    schedule();
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
}
