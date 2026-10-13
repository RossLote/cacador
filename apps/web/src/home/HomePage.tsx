import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { examTimeLeft, READINESS_TARGET_PERCENT, readiness, type Readiness } from '@/model';
import { getStates, getUnfinishedExam, type Exam } from '@/storage';

const MINUTE_MS = 60 * 1000;

interface HomeData {
  readiness: Readiness;
  /** The exam in progress, if any; the storage module never returns one past its deadline (D3). */
  exam: Exam | undefined;
}

/** Everything Home shows. The exam is asked for first: settling one past its deadline logs its answers into the states. */
async function loadHome(): Promise<HomeData> {
  const exam = await getUnfinishedExam();
  const states = await getStates();
  return { exam, readiness: readiness(states) };
}

/** The home data, and a reload for when the exam in progress reaches its deadline while Home is open. */
function useHomeData() {
  const [data, setData] = useState<HomeData | undefined>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    void loadHome().then((loaded) => {
      if (active) setData(loaded);
    });
    return () => {
      active = false;
    };
  }, [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, reload };
}

/**
 * Whole minutes left in the exam, rounded up so 29:30 shows 30 and the last
 * seconds show 1. Wakes when the shown minute changes, and calls `onDeadline`
 * once none is left (0 is never shown).
 */
function useMinutesLeft(exam: Exam, onDeadline: () => void): number {
  const [now, setNow] = useState(Date.now);
  const left = examTimeLeft(exam, now);
  useEffect(() => {
    if (left <= 0) {
      onDeadline();
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), left % MINUTE_MS || MINUTE_MS);
    return () => clearTimeout(timer);
  }, [left, onDeadline]);
  return Math.ceil(left / MINUTE_MS);
}

function ExamCard({ exam, onDeadline }: { exam: Exam; onDeadline: () => void }) {
  const { t } = useI18n();
  const minutes = useMinutesLeft(exam, onDeadline);
  if (minutes <= 0) return null;
  return (
    <Link to="/exam" className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="flex-row items-center justify-between gap-4 px-(--card-spacing) transition-colors hover:bg-muted">
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium">{t.home.examInProgress}</span>
          <span className="text-muted-foreground tabular-nums">{t.home.minutesLeft(minutes)}</span>
        </div>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
      </Card>
    </Link>
  );
}

/** Readiness as one large number with the unseen count beside it, over a plain bar marked at the pass line. */
function ReadinessPanel({ value }: { value: Readiness | undefined }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="home-readiness" className="flex min-h-36 flex-col gap-3">
      <h2 id="home-readiness" className="text-sm font-medium text-muted-foreground">
        {t.home.readiness}
      </h2>
      {value === undefined ? (
        <p role="status" className="sr-only">
          {t.home.loading}
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-6xl font-semibold tracking-tight tabular-nums">{t.home.percent(value.percent)}</span>
            <span className="text-lg text-muted-foreground tabular-nums">{t.home.unseen(value.unseen)}</span>
          </p>
          <div className="relative">
            <Progress value={value.percent} aria-label={t.home.readiness} className="*:data-[slot=progress-track]:h-2" />
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground"
              style={{ left: `${READINESS_TARGET_PERCENT}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t.home.passLine(READINESS_TARGET_PERCENT)}</p>
        </>
      )}
    </section>
  );
}

/** Home (DESIGN.md § 6.3, D11): the hub. Readiness, the exam in progress when there is one, and the four buttons. */
export function HomePage() {
  const { t } = useI18n();
  const { data, reload } = useHomeData();
  const buttons = [
    { to: '/practice', label: t.common.nav.practice, variant: 'default' },
    { to: '/exam', label: t.common.nav.exam, variant: 'outline' },
    { to: '/progress', label: t.common.nav.progress, variant: 'outline' },
    { to: '/settings', label: t.common.nav.settings, variant: 'outline' },
  ] as const;

  return (
    <section className="flex flex-col gap-8 pt-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t.home.title}</h1>
      {data?.exam && <ExamCard key={data.exam.id} exam={data.exam} onDeadline={reload} />}
      <ReadinessPanel value={data?.readiness} />
      <nav className="grid grid-cols-2 gap-3">
        {buttons.map(({ to, label, variant }) => (
          <Link key={to} to={to} className={cn(buttonVariants({ variant, size: 'lg' }), 'h-12 text-base')}>
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
