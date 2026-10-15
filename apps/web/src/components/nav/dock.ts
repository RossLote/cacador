import { createContext, useContext, useEffect } from 'react';

/**
 * The dock (DESIGN.md § 8.2): a slot in the layout's footer, directly above
 * the tab bar, pinned to the bottom of the viewport with it. A screen portals
 * into it the controls a thumb must find in the same place every time,
 * Practice's Hold for English and Hint, so a peek that reflows the question
 * never moves them. Null outside the layout, and before it has mounted.
 */
export const DockContext = createContext<HTMLElement | null>(null);

/** The layout's dock element, or null when there is none to portal into. */
export function useDock(): HTMLElement | null {
  return useContext(DockContext);
}

/**
 * Keeps the page's bottom scroll padding at the footer's height, so a scroll
 * into view (the hint panel opening, a control focused from the keyboard)
 * stops above the dock and the tab bar rather than behind them.
 */
export function useFooterScrollPadding(footer: HTMLElement | null): void {
  useEffect(() => {
    if (footer === null || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.scrollPaddingBottom = `${footer.offsetHeight}px`;
    });
    observer.observe(footer);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingBottom = '';
    };
  }, [footer]);
}
