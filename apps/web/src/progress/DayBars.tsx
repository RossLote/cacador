import { PLATE } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { LOCALE_TAGS } from '@/i18n/locales';
import { cn } from '@/lib/utils';
import type { DayAccuracy } from '@/model';
import { ACCURACY_DAYS } from '@/model/progress';

/**
 * Accuracy by day (DESIGN.md § 6.6, D10): the 30-day plate, one square-topped
 * block per calendar day, oldest first and today last, its height following
 * the day's answers: the right share in forest at the bottom (rust for today)
 * under the rest in the track colour, over an ink baseline. No chart library.
 */
export function DayBars({ days }: { days: readonly DayAccuracy[] }) {
  const { t, locale } = useI18n();
  const most = Math.max(1, ...days.map((day) => day.total));
  const shortDate = (day: DayAccuracy) =>
    new Date(day.start).toLocaleDateString(LOCALE_TAGS[locale], { day: 'numeric', month: 'short' });
  const first = days[0];
  const today = days.at(-1);

  return (
    <section aria-labelledby="progress-days" className={cn('flex flex-col gap-2.5', PLATE)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="progress-days" className="eyebrow">
          {t.progress.days(ACCURACY_DAYS)}
        </h2>
        {today && (
          <p className="text-[13px] text-muted-foreground tabular-nums">{t.progress.todayCounts(today.total, today.correct)}</p>
        )}
      </div>
      <ol aria-label={t.progress.daysChart} className="flex h-21 items-end gap-[3px] border-b border-ink pb-px">
        {days.map((day) => {
          const isToday = day === today;
          const label = (isToday ? t.progress.todayBar : t.progress.dayBar)(shortDate(day), day.total, day.correct);
          return (
            <li key={day.date} className="flex h-full min-w-0 flex-1 items-end">
              <div
                role="img"
                aria-label={label}
                title={label}
                // A day with answers stays at least 4 px tall beside a much fuller one; its two blocks share
                // whatever height it has by their counts.
                className={cn('flex w-full flex-col justify-end', day.total > 0 && 'min-h-1')}
                style={{ height: `${(day.total / most) * 100}%` }}
              >
                {day.total > day.correct && (
                  <div className="basis-0 bg-track" style={{ flexGrow: day.total - day.correct }} />
                )}
                {day.correct > 0 && (
                  <div
                    data-slot="day-right"
                    className={cn('basis-0', isToday ? 'bg-rust' : 'bg-forest')}
                    style={{ flexGrow: day.correct }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted-foreground">
        <span>{first && shortDate(first)}</span>
        <span className="font-bold text-rust">{t.progress.today}</span>
      </div>
    </section>
  );
}
