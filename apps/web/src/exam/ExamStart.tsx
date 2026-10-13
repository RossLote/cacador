import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { drawExam, EXAM_DURATION_MS, EXAM_PASS_MARK, EXAM_SIZE, MINUTE_MS } from '@/model';
import { createExam, getUnfinishedExam, type Exam } from '@/storage';
import { RunningExam } from './RunningExam';

/** The exam to resume, or null when there is none. */
async function loadUnfinished(): Promise<Exam | null> {
  return (await getUnfinishedExam()) ?? null;
}

/**
 * /exam: the unfinished exam resumed with its answers when the storage module
 * returns one (it settles any exam past its deadline first, so a resumed exam
 * always has time left), otherwise Start, which draws 20 questions uniformly,
 * saves the exam with its start time and runs it here.
 */
export function ExamStart() {
  const { t } = useI18n();
  /** `exam` is undefined while storage is read, null when there is no exam to resume. */
  const { data: exam, failed, set: setExam } = useLoaded(loadUnfinished);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const start = () => {
    setStarting(true);
    setStartFailed(false);
    void createExam(drawExam()).then(setExam, () => {
      setStarting(false);
      setStartFailed(true);
    });
  };

  if (exam) return <RunningExam key={exam.id} exam={exam} />;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t.exam.title}</h1>
      {failed ? (
        <p role="status" className="text-muted-foreground">
          {t.exam.loadFailed}
        </p>
      ) : exam === undefined ? (
        <p role="status" className="text-muted-foreground">
          {t.exam.loading}
        </p>
      ) : (
        <>
          <p className="text-lg leading-snug">{t.exam.intro(EXAM_SIZE, EXAM_DURATION_MS / MINUTE_MS, EXAM_PASS_MARK)}</p>
          <p className="text-muted-foreground">{t.exam.rules}</p>
          <Button type="button" size="lg" className="h-12 text-base sm:self-start sm:px-8" disabled={starting} onClick={start}>
            {t.exam.start}
          </Button>
          {startFailed && (
            <p role="status" className="text-sm text-destructive">
              {t.exam.loadFailed}
            </p>
          )}
        </>
      )}
    </section>
  );
}
