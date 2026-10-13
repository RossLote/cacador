import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/useI18n';
import { GROUP_KINDS, type GroupKind, type StateMap } from '@/model';
import { groupRows, type GroupRow } from './groups';

function GroupList({ rows }: { rows: readonly GroupRow[] }) {
  const { t } = useI18n();
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y divide-border">
        {rows.map(({ slug, name, to, accuracy: { percent, seen, total } }) => (
          <li key={slug}>
            <Link
              to={to}
              aria-label={
                percent === undefined ? t.progress.notStartedRow(name, total) : t.progress.startedRow(name, percent, seen, total)
              }
              className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-medium">{name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {percent === undefined ? t.progress.questions(total) : t.progress.seen(seen, total)}
                </span>
              </span>
              {percent === undefined ? (
                <span className="shrink-0 text-sm text-muted-foreground">{t.progress.notStarted}</span>
              ) : (
                <span className="shrink-0 text-lg font-semibold tabular-nums">{t.progress.percent(percent)}</span>
              )}
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Topics, sections and patterns, one tab each, every row a link into focused practice (D4, D11). */
export function GroupTabs({ states }: { states: StateMap }) {
  const { t, locale } = useI18n();
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
    <section aria-labelledby="progress-groups" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="progress-groups" className="text-sm font-medium text-muted-foreground">
          {t.progress.groups}
        </h2>
        <p className="text-sm text-muted-foreground">{t.progress.groupsHint}</p>
      </div>
      <Tabs defaultValue="topic" className="gap-3">
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
