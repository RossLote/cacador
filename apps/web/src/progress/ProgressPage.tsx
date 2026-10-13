import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import {
  ACCURACY_DAYS,
  accuracyByDay,
  READINESS_TARGET_PERCENT,
  readiness,
  type DayAccuracy,
  type Readiness,
  type StateMap,
} from '@/model';
import { getStates, getUnfinishedExam, listAnswers, listExams, listFlags, type Exam } from '@/storage';
import { DayBars } from './DayBars';
import { GroupTabs } from './GroupTabs';
import { PastExams } from './PastExams';

interface ProgressData {
  readiness: Readiness;
  days: DayAccuracy[];
  states: StateMap;
  /** Finished exams only, newest first. */
  exams: Exam[];
  flagCount: number;
}

/** Local midnight at the start of the chart's oldest day: the answers log is read from there. */
function windowStart(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (ACCURACY_DAYS - 1)).getTime();
}

/**
 * Everything Progress shows. The unfinished exam is asked for first, as Home
 * does: settling one past its deadline logs its answers before the numbers
 * are read (D3).
 */
async function loadProgress(): Promise<ProgressData> {
  const now = Date.now();
  await getUnfinishedExam(now);
  const states = await getStates();
  const answers = await listAnswers(windowStart(now));
  const exams = (await listExams())
    .filter((exam) => exam.finishedAt !== undefined)
    .sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt));
  const flags = await listFlags();
  return { readiness: readiness(states), days: accuracyByDay(answers, now), states, exams, flagCount: flags.length };
}

/** Readiness and the unseen count, worded as on Home (D11). */
function ReadinessSummary({ value }: { value: Readiness }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="progress-readiness" className="flex flex-col gap-1">
      <h2 id="progress-readiness" className="text-sm font-medium text-muted-foreground">
        {t.progress.readiness}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-5xl font-semibold tracking-tight tabular-nums">{t.progress.percent(value.percent)}</span>
        <span className="text-lg text-muted-foreground tabular-nums">{t.progress.unseen(value.unseen)}</span>
      </p>
      <p className="text-sm text-muted-foreground">{t.progress.passLine(READINESS_TARGET_PERCENT)}</p>
    </section>
  );
}

/** Progress (DESIGN.md § 6.6, D11): readiness, 30 days of answers, the group lists, past exams and the Flagged link. */
export function ProgressPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ProgressData | undefined>();

  useEffect(() => {
    let active = true;
    void loadProgress().then((loaded) => {
      if (active) setData(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.progress.title}</h1>
      {data === undefined ? (
        <p role="status" className="sr-only">
          {t.progress.loading}
        </p>
      ) : (
        <>
          <ReadinessSummary value={data.readiness} />
          <DayBars days={data.days} />
          <GroupTabs states={data.states} />
          <PastExams exams={data.exams} />
          <Link
            to="/flagged"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 justify-between text-base')}
          >
            {t.progress.flagged(data.flagCount)}
            <ArrowRight aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}
