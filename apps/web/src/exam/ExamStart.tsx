import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { drawExam, EXAM_DURATION_MS, EXAM_PASS_MARK, EXAM_SIZE, type RandomSource } from '@/model';
import { createExam, getUnfinishedExam, type Exam } from '@/storage';
import { RunningExam } from './RunningExam';

const MINUTE_MS = 60 * 1000;

export interface ExamStartProps {
  /** The source the exam draw uses; Math.random otherwise. */
  random?: RandomSource;
}

/**
 * /exam: the unfinished exam resumed with its answers when the storage module
 * returns one (it settles any exam past its deadline first, so a resumed exam
 * always has time left), otherwise Start, which draws 20 questions uniformly,
 * saves the exam with its start time and runs it here.
 */
export function ExamStart({ random = Math.random }: ExamStartProps) {
  const { t } = useI18n();
  /** undefined while storage is read, null when there is no exam to resume. */
  const [exam, setExam] = useState<Exam | null>();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    void getUnfinishedExam().then((found) => {
      if (active) setExam(found ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const start = () => {
    setStarting(true);
    void createExam(drawExam(random)).then(setExam, () => setStarting(false));
  };

  if (exam) return <RunningExam key={exam.id} exam={exam} />;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t.exam.title}</h1>
      {exam === undefined ? (
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
        </>
      )}
    </section>
  );
}
