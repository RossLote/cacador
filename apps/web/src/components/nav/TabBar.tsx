import { Link, useLocation } from 'react-router';
import { FOCUS_RING } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { currentTab, TABS } from './tabs';

/**
 * The menu (DESIGN.md § 6.3, D5): four tabs fixed to the bottom of the
 * viewport inside the app's column. Each link is named by its navigation word
 * alone (the icon is hidden). The current tab is forest with its label bold
 * and its icon filled with the moss tint, at the one icon stroke of 1.75
 * (DESIGN.md § 8.5), and carries aria-current="page"; on a screen that is not
 * a tab none does. A tapped link lets go of the focus, the current tab's too,
 * so it falls back to the body and the screen's own keys (Practice's laptop
 * keys) act at once.
 */
export function TabBar() {
  const { t } = useI18n();
  const current = currentTab(useLocation().pathname);
  return (
    <nav
      aria-label={t.common.mainNav}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto grid w-full max-w-2xl grid-cols-4 gap-1 border-t border-line bg-card px-2 py-2.5"
    >
      {TABS.map((tab) => {
        const active = tab === current;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => event.currentTarget.blur()}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[11px] leading-none',
              FOCUS_RING,
              active ? 'font-bold text-forest' : 'font-semibold text-muted-foreground hover:text-ink',
            )}
          >
            <tab.Icon aria-hidden="true" className={cn('size-6', active && 'fill-moss')} strokeWidth={1.75} />
            {t.common.nav[tab.label]}
          </Link>
        );
      })}
    </nav>
  );
}
