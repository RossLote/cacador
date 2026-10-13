import { useI18n } from '@/i18n/useI18n';
import { LOCALE_TAGS } from '@/i18n/locales';
import { cn } from '@/lib/utils';
import type { DayAccuracy } from '@/model';

/**
 * Accuracy by day (DESIGN.md § 6.6): one plain block per calendar day, oldest
 * first and today last, its height following the day's answers and the right
 * share filled in the success colour. No chart library (D7).
 */
export function DayBars({ days }: { days: readonly DayAccuracy[] }) {
  const { t, locale } = useI18n();
  const most = Math.max(1, ...days.map((day) => day.total));
  const shortDate = (day: DayAccuracy) =>
    new Date(day.start).toLocaleDateString(LOCALE_TAGS[locale], { day: 'numeric', month: 'short' });
  const first = days[0];
  const today = days.at(-1);

  return (
    <section aria-labelledby="progress-days" className="flex flex-col gap-3">
      <h2 id="progress-days" className="text-sm font-medium text-muted-foreground">
        {t.progress.days}
      </h2>
      <div className="flex flex-col gap-1.5">
        <ol aria-label={t.progress.daysChart} className="flex h-28 items-end gap-0.5 sm:gap-1">
          {days.map((day) => {
            const isToday = day === today;
            const label = (isToday ? t.progress.todayBar : t.progress.dayBar)(shortDate(day), day.total, day.correct);
            return (
              <li key={day.date} className="flex h-full min-w-0 flex-1 items-end">
                <div
                  role="img"
                  aria-label={label}
                  title={label}
                  className={cn(
                    'flex min-h-1 w-full flex-col justify-end overflow-hidden rounded-t-sm',
                    day.total > 0 ? 'bg-muted-foreground/30' : 'bg-muted',
                  )}
                  style={{ height: `${(day.total / most) * 100}%` }}
                >
                  {day.total > 0 && (
                    <div className="bg-success" style={{ height: `${(day.correct / day.total) * 100}%` }} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div aria-hidden="true" className="flex justify-between text-xs text-muted-foreground">
          <span>{first && shortDate(first)}</span>
          <span className="font-medium text-foreground">{t.progress.today}</span>
        </div>
      </div>
      {today && (
        <p className="text-sm tabular-nums">{t.progress.todayCounts(today.total, today.correct)}</p>
      )}
    </section>
  );
}
