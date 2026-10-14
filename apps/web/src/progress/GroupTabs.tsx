import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/useI18n';
import { isOneOf } from '@/lib/isOneOf';
import { cn } from '@/lib/utils';
import { GROUP_KINDS, READINESS_TARGET_PERCENT, type GroupKind, type StateMap } from '@/model';
import { groupRows, type GroupRow } from './groups';

function GroupList({ rows }: { rows: readonly GroupRow[] }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(({ slug, name, to, accuracy: { percent, seen, total } }) => {
        const tone = percent !== undefined && percent < READINESS_TARGET_PERCENT ? 'rust' : 'forest';
        return (
          <li key={slug}>
            <Link
              to={to}
              aria-label={
                percent === undefined ? t.progress.notStartedRow(name, total) : t.progress.startedRow(name, percent, seen, total)
              }
              className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-card px-3.5 py-3 text-ink outline-none transition-colors hover:bg-track focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">{name}</span>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {percent === undefined ? t.progress.notStartedLine(total) : t.progress.seen(seen, total)}
                </span>
              </span>
              <span aria-hidden="true" className="h-1.5 w-16 shrink-0 overflow-hidden rounded-[3px] bg-track">
                <span
                  data-slot="mini-bar-fill"
                  className={cn('block h-full', tone === 'rust' ? 'bg-rust' : 'bg-forest')}
                  style={{ width: `${percent ?? 0}%` }}
                />
              </span>
              <span
                data-slot="row-percent"
                className={cn(
                  'w-13 shrink-0 text-right font-heading text-xl leading-none font-semibold tabular-nums',
                  percent === undefined ? 'text-muted-foreground' : tone === 'rust' ? 'text-rust' : 'text-forest',
                )}
              >
                {percent === undefined ? t.progress.noPercent : t.progress.percent(percent)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The query parameter holding the open tab, so back from focused practice returns to it. */
const TAB_PARAM = 'tab';
const DEFAULT_KIND: GroupKind = 'topic';

const isGroupKind = isOneOf(GROUP_KINDS);

/**
 * Topics, sections and patterns, one tab each, every row a link into focused
 * practice (D4, D11). The open tab lives in the address (/progress?tab=section,
 * the topics tab having no parameter), replaced rather than pushed, so back
 * from a row's practice lands on the list it was tapped in.
 */
export function GroupTabs({ states }: { states: StateMap }) {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const requested = params.get(TAB_PARAM);
  const open = isGroupKind(requested) ? requested : DEFAULT_KIND;
  const choose = (value: unknown) => {
    if (!isGroupKind(value)) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === DEFAULT_KIND) next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, value);
        return next;
      },
      { replace: true },
    );
  };
  const lists = useMemo(
    () => GROUP_KINDS.map((kind) => ({ kind, rows: groupRows(kind, states, locale) })),
    [states, locale],
  );
  const tabLabel: Record<GroupKind, string> = {
    topic: t.progress.topics,
    section: t.progress.sections,
    pattern: t.progress.patterns,
  };

  return (
    <section aria-labelledby="progress-groups" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="progress-groups" className="eyebrow">
          {t.progress.groups}
        </h2>
        <p className="text-right text-[13px] text-muted-foreground">{t.progress.groupsHint}</p>
      </div>
      <Tabs value={open} onValueChange={choose} className="gap-2.5">
        <TabsList className="w-full">
          {lists.map(({ kind }) => (
            <TabsTrigger key={kind} value={kind}>
              {tabLabel[kind]}
            </TabsTrigger>
          ))}
        </TabsList>
        {lists.map(({ kind, rows }) => (
          <TabsContent key={kind} value={kind}>
            <GroupList rows={rows} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
