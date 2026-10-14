import { ChevronRight, Flag } from 'lucide-react';
import { Link } from 'react-router';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
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
import { useDayRefresh } from './useDayRefresh';

interface ProgressData {
  readiness: Readiness;
  days: DayAccuracy[];
  states: StateMap;
  /** Finished exams only, newest finished first. */
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
    // Past exams (DESIGN.md § 6.6): finished ones only, newest finished first, so the order follows the date each
    // row shows. This is the one definition of the order; storage's listExams sorts by start, and the two differ
    // when exams overlap (possible after an import merges two devices).
    exams: exams.filter(isFinished).sort((a, b) => b.finishedAt - a.finishedAt),
    flagCount: flags.length,
  };
}

/**
 * Readiness at the right of the header (D10): the percentage in Fraunces 26 px, then the unseen count, worded as on
 * Home (D11). It stays the region named Readiness, and the pass line stays in the text for a screen reader.
 */
function ReadinessSummary({ value }: { value: Readiness }) {
  const { t } = useI18n();
  return (
    <section aria-label={t.progress.readiness} className="flex shrink-0 items-baseline gap-1.5 pr-0.5">
      <span className="font-heading text-[26px] leading-none font-semibold tabular-nums">
        {t.progress.percent(value.percent)}
      </span>
      <span aria-hidden="true" className="text-[13px] text-muted-foreground">
        ·
      </span>
      <span className="text-[13px] text-muted-foreground tabular-nums">{t.progress.unseen(value.unseen)}</span>
      <span className="sr-only">{t.progress.passLine(READINESS_TARGET_PERCENT)}</span>
    </section>
  );
}

/** Progress (DESIGN.md § 6.6, D11): readiness in the header, 30 days of answers, the group lists, past exams and the Flagged link. */
export function ProgressPage() {
  const { t } = useI18n();
  const { data, failed, reload } = useLoaded(loadProgress);
  // Reads again with a new "now" at midnight and on return to the page, so today stays today.
  useDayRefresh(reload);

  return (
    <section className="flex flex-col gap-4.5">
      <ScreenHeader
        title={t.progress.title}
        aside={data === undefined ? undefined : <ReadinessSummary value={data.readiness} />}
      />
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
          <DayBars days={data.days} />
          <GroupTabs states={data.states} />
          <PastExams exams={data.exams} />
          <Link
            to="/flagged"
            className="flex min-h-12 items-center gap-2.5 rounded-md border border-ink px-3.5 py-3 text-base font-semibold text-ink outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Flag aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
            <span className="flex-1">{t.progress.flagged(data.flagCount)}</span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
          </Link>
        </>
      )}
    </section>
  );
}
