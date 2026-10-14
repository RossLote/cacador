import { useMemo } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { READINESS_TARGET_PERCENT, type StateMap } from '@/model';
import { groupRows } from '@/progress/groups';

/** How many of the weakest started topics Home lists (D7). */
const WEAKEST_COUNT = 2;

/**
 * Weakest topics (DESIGN.md § 6.3, D7): the two lowest started topics in the
 * Progress topic list's worst-first order, each a card row linking to focused
 * practice on it, under an eyebrow with the All topics link to Progress. One
 * row when one topic is started; nothing at all while none is.
 */
export function WeakestTopics({ states }: { states: StateMap }) {
  const { t, locale } = useI18n();
  const rows = useMemo(
    () =>
      groupRows('topic', states, locale)
        .flatMap(({ accuracy: { percent, seen, total }, ...row }) =>
          percent === undefined ? [] : [{ ...row, percent, seen, total }],
        )
        .slice(0, WEAKEST_COUNT),
    [states, locale],
  );
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="home-weakest" className="mt-1 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-weakest" className="eyebrow">
          {t.home.weakestTopics}
        </h2>
        <Link
          to="/progress"
          className="-mr-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-forest outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t.home.allTopics}
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map(({ slug, name, to, percent, seen, total }) => (
          <li key={slug}>
            <Link
              to={to}
              aria-label={t.home.topicRow(name, percent, seen, total)}
              className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-card px-3.5 py-3 text-ink outline-none transition-colors hover:bg-track focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">{name}</span>
                <span className="text-[13px] text-muted-foreground tabular-nums">{t.home.seen(seen, total)}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-heading text-[22px] leading-none font-semibold tabular-nums',
                  percent < READINESS_TARGET_PERCENT ? 'text-rust' : 'text-forest',
                )}
              >
                {t.home.percent(percent)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
