import { ArrowRight } from 'lucide-react';
import { LinkButton } from '@/components/LinkButton';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import {
  accuracyByDay,
  accuracyWindowStart,
  isFinished,
  READINESS_TARGET_PERCENT,
  readiness,
  type DayAccuracy,
  type FinishedExam,
  type Readiness,
  type StateMap,
} from '@/model';
import { getStates, listAnswers, listExams, listFlags } from '@/storage';
import { DayBars } from './DayBars';
import { GroupTabs } from './GroupTabs';
import { PastExams } from './PastExams';

interface ProgressData {
  readiness: Readiness;
  days: DayAccuracy[];
  states: StateMap;
  /** Finished exams only, newest first. */
  exams: FinishedExam[];
  flagCount: number;
}

/**
 * Everything Progress shows. Each read settles an exam past its deadline
 * first, so its answers are counted and it is listed with its score (D3).
 */
async function loadProgress(): Promise<ProgressData> {
  const now = Date.now();
  const [states, answers, exams, flags] = await Promise.all([
    getStates(),
    listAnswers(accuracyWindowStart(now)),
    listExams(),
    listFlags(),
  ]);
  return {
    readiness: readiness(states),
    days: accuracyByDay(answers, now),
    states,
    exams: exams.filter(isFinished).sort((a, b) => b.finishedAt - a.finishedAt),
    flagCount: flags.length,
  };
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
  const { data, failed } = useLoaded(loadProgress);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.progress.title}</h1>
      {failed ? (
        <p role="status" className="text-muted-foreground">
          {t.progress.loadFailed}
        </p>
      ) : data === undefined ? (
        <p role="status" className="sr-only">
          {t.progress.loading}
        </p>
      ) : (
        <>
          <ReadinessSummary value={data.readiness} />
          <DayBars days={data.days} />
          <GroupTabs states={data.states} />
          <PastExams exams={data.exams} />
          <LinkButton to="/flagged" variant="outline" size="lg" className="h-12 justify-between text-base">
            {t.progress.flagged(data.flagCount)}
            <ArrowRight aria-hidden="true" />
          </LinkButton>
        </>
      )}
    </section>
  );
}
