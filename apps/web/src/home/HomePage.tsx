import { ChevronRight, SlidersHorizontal, Target, Timer, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { FOCUS_RING, PLATE } from '@/components/styles';
import { Progress } from '@/components/ui/progress';
import { useExamClock } from '@/exam/useExamClock';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { cn } from '@/lib/utils';
import {
  EXAM_DURATION_MS,
  EXAM_SIZE,
  MINUTE_MS,
  READINESS_TARGET_PERCENT,
  readiness,
  type Readiness,
  type StateMap,
} from '@/model';
import { getStates, getUnfinishedExam, type Exam } from '@/storage';
import { WeakestTopics } from './WeakestTopics';

interface HomeData {
  readiness: Readiness;
  /** Every question's state, for the weakest topics. */
  states: StateMap;
  /** The exam in progress, if any; the storage module never returns one past its deadline (D3). */
  exam: Exam | undefined;
}

/** Everything Home shows. Each read settles an exam past its deadline first, so its answers are in the states (D3). */
async function loadHome(): Promise<HomeData> {
  const [exam, states] = await Promise.all([getUnfinishedExam(), getStates()]);
  return { exam, states, readiness: readiness(states) };
}

/** Home's header (D6): the app name in Fraunces 34 px, and at its right the control to Settings. */
function HomeHeader() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 pt-1.5">
      <h1 className="font-heading text-[34px] leading-none font-semibold">{t.home.title}</h1>
      <Link
        to="/settings"
        aria-label={t.common.nav.settings}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line text-ink transition-colors hover:bg-card',
          FOCUS_RING,
        )}
      >
        <SlidersHorizontal aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

/**
 * The exam in progress (D7): clay with a rust hairline, the timer and the
 * chevron in rust, the text in ink (DESIGN.md § 8.5). Its line is the whole
 * minutes left, rounded up so 29:30 shows 30 and the last seconds show 1, and
 * the questions answered. The clock wakes when the shown minute changes, and
 * calls `onDeadline` once none is left (0 is never shown).
 */
function ExamInProgressCard({ exam, onDeadline }: { exam: Exam; onDeadline: () => void }) {
  const { t } = useI18n();
  const minutes = Math.ceil(useExamClock(exam, onDeadline, MINUTE_MS) / MINUTE_MS);
  if (minutes <= 0) return null;
  const answered = Object.keys(exam.answers).length;
  return (
    <Link
      to="/exam"
      className={cn('flex items-center gap-3.5 rounded-lg border border-rust bg-clay px-4 py-3.5 text-ink', FOCUS_RING)}
    >
      <Timer aria-hidden="true" className="size-[26px] shrink-0 text-rust" strokeWidth={1.75} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-lg leading-snug font-semibold">{t.home.examInProgress}</span>{' '}
        <span className="text-sm tabular-nums">{t.home.examStatus(minutes, answered, EXAM_SIZE)}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-rust" strokeWidth={2} />
    </Link>
  );
}

/**
 * The readiness plate (D7): the percentage in Fraunces 64 px with the unseen
 * count beside it, a forest bar on the track with a rust tick at the pass
 * line and the pass line's words in rust under it; or why it is missing.
 */
function ReadinessPlate({ value, failed }: { value: Readiness | undefined; failed: boolean }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="home-readiness" className={cn('flex min-h-36 flex-col gap-2.5', PLATE)}>
      <h2 id="home-readiness" className="eyebrow">
        {t.home.readiness}
      </h2>
      {failed ? (
        <p role="status" className="text-muted-foreground">
          {t.home.loadFailed}
        </p>
      ) : value === undefined ? (
        <p role="status" className="sr-only">
          {t.home.loading}
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-heading text-[64px] leading-none font-semibold tabular-nums">
              {t.home.percent(value.percent)}
            </span>
            <span className="text-[15px] text-muted-foreground tabular-nums">{t.home.unseen(value.unseen)}</span>
          </p>
          <div className="relative mt-1.5">
            <Progress value={value.percent} aria-label={t.home.readiness} />
            <span
              aria-hidden="true"
              data-slot="pass-tick"
              className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-rust"
              style={{ left: `${READINESS_TARGET_PERCENT}%` }}
            />
          </div>
          <p className="text-right text-[13px] font-semibold text-rust">{t.home.passLine(READINESS_TARGET_PERCENT)}</p>
        </>
      )}
    </section>
  );
}

interface StartCardProps {
  to: string;
  Icon: LucideIcon;
  title: string;
  line: string;
  /** Practice is the one thing to do next, filled rust; Exam is a card with the ink hairline. */
  primary: boolean;
}

/**
 * One of the two cards side by side (D7). Its accessible name is the title, a
 * space, then the line, so a link named exactly "Practice" or "Exam" is the
 * tab, never the card (D5).
 */
function StartCard({ to, Icon, title, line, primary }: StartCardProps) {
  return (
    <Link
      to={to}
      data-slot="start-card"
      className={cn(
        'flex min-h-[110px] flex-col gap-2.5 rounded-lg px-4 py-4.5 transition-colors',
        primary ? 'bg-rust text-on-fill hover:bg-rust/90' : 'border border-ink bg-card text-ink hover:bg-track',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden="true" className="size-[26px]" strokeWidth={1.75} />
      <span className="mt-auto font-heading text-[22px] leading-tight font-semibold">{title}</span>{' '}
      <span className={cn('text-[13px]', !primary && 'text-muted-foreground')}>{line}</span>
    </Link>
  );
}

/**
 * Home (DESIGN.md § 6.3, D7): the hub. The header, the readiness plate, the
 * exam in progress when there is one, the Practice and Exam cards, and the
 * weakest topics once a topic is started.
 */
export function HomePage() {
  const { t } = useI18n();
  // Reloaded when the exam in progress reaches its deadline while Home is open.
  const { data, failed, reload } = useLoaded(loadHome);

  return (
    <section className="flex flex-col gap-3.5">
      <HomeHeader />
      <ReadinessPlate value={data?.readiness} failed={failed} />
      {data?.exam && <ExamInProgressCard key={data.exam.id} exam={data.exam} onDeadline={reload} />}
      <div className="grid grid-cols-2 gap-2.5">
        <StartCard to="/practice" Icon={Target} title={t.common.nav.practice} line={t.home.practiceLine} primary />
        <StartCard
          to="/exam"
          Icon={Timer}
          title={t.common.nav.exam}
          line={t.home.examLine(EXAM_SIZE, EXAM_DURATION_MS / MINUTE_MS)}
          primary={false}
        />
      </div>
      {data && <WeakestTopics states={data.states} />}
    </section>
  );
}
