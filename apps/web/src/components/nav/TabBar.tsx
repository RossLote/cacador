import { Link, useLocation } from 'react-router';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { currentTab, TABS } from './tabs';

/**
 * The menu (DESIGN.md § 6.3, D5): four tabs fixed to the bottom of the
 * viewport inside the app's column, above the home indicator. Each link is
 * named by its navigation word alone (the icon is hidden). The current tab is
 * forest with its label bold and its icon filled with the moss tint at a
 * heavier stroke, as the artboard draws it, and carries aria-current="page";
 * on a screen that is not a tab none does.
 */
export function TabBar() {
  const { t } = useI18n();
  const current = currentTab(useLocation().pathname);
  return (
    <nav
      aria-label={t.common.mainNav}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto grid w-full max-w-2xl grid-cols-4 gap-1 border-t border-line bg-card px-2 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
    >
      {TABS.map((tab) => {
        const active = tab === current;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[11px] leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? 'font-bold text-forest' : 'font-semibold text-muted-foreground hover:text-ink',
            )}
          >
            <tab.Icon
              aria-hidden="true"
              className={cn('size-6', active && 'fill-moss')}
              strokeWidth={active ? 2 : 1.75}
            />
            {t.common.nav[tab.label]}
          </Link>
        );
      })}
    </nav>
  );
}
