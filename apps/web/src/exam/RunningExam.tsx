import { questionById, type OptionKey } from '@cacador/data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { QuestionCard } from '@/components/question/QuestionCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { finishExam, saveExamAnswers, type Exam } from '@/storage';
import { ExamMarkers } from './ExamMarkers';
import { formatClock, useExamClock } from './useExamClock';

/** Where a resumed exam opens: its first unanswered question, or the first when all are answered. */
function firstUnanswered(exam: Exam): number {
  const index = exam.questionIds.findIndex((id) => exam.answers[id] === undefined);
  return Math.max(0, index);
}

/**
 * The running mock exam (DESIGN.md § 6.5, D3): one question at a time on the
 * card with the selection shown and nothing revealed, no peek, no hint and no
 * keys (D9, D20); markers, Previous and Next move freely; every answer change
 * is saved at once; the clock counts down from the start time. Submit, after
 * asking when questions are unanswered, and the clock reaching zero both
 * finish the exam through the storage module's once-only finish and open its
 * results, whether this page's finish ran or an earlier one had.
 */
export function RunningExam({ exam }: { exam: Exam }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<number, OptionKey>>(exam.answers);
  const [current, setCurrent] = useState(() => firstUnanswered(exam));
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  /** The answer saves in order; the finish waits for the last. */
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const ended = useRef(false);

  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    setEnding(true);
    setConfirming(false);
    void saving.current
      .then(() => finishExam(exam.id))
      .catch(() => undefined)
      .then(() => navigate(`/exam/results/${exam.id}`, { replace: true }));
  }, [exam.id, navigate]);

  const left = useExamClock(exam, end);

  const total = exam.questionIds.length;
  const questionId = exam.questionIds[current] as number;
  const question = questionById(questionId);
  const unanswered = exam.questionIds.filter((id) => answers[id] === undefined).length;

  const select = (option: OptionKey) => {
    if (ended.current) return;
    const next = { ...answers, [questionId]: option };
    setAnswers(next);
    const save = saving.current.then(() => saveExamAnswers(exam.id, next));
    saving.current = save.catch(() => undefined);
    // Refused: the exam was finished elsewhere or its time is up, so it ends here too.
    void save.then((saved) => saved || end(), () => undefined);
  };

  const move = (index: number) => {
    setCurrent(index);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  };

  const submit = () => {
    if (unanswered > 0) setConfirming(true);
    else end();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.exam.title}</h1>
        <p className="text-muted-foreground tabular-nums">{t.exam.position(current + 1, total)}</p>
        <p role="timer" aria-label={t.exam.timeLeft} className="text-2xl font-semibold tabular-nums">
          {formatClock(left)}
        </p>
      </div>

      <ExamMarkers
        answered={exam.questionIds.map((id) => answers[id] !== undefined)}
        current={current}
        onJump={move}
      />

      {question && (
        <QuestionCard
          question={question}
          selected={answers[questionId]}
          revealed={false}
          locked={ending}
          onSelect={select}
          peekEnabled={false}
          hintEnabled={false}
        />
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-28"
          disabled={current === 0}
          onClick={() => move(current - 1)}
        >
          <ArrowLeft aria-hidden="true" />
          {t.exam.previous}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="ml-auto min-w-28"
          disabled={current === total - 1}
          onClick={() => move(current + 1)}
        >
          {t.exam.next}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        variant={unanswered === 0 ? 'default' : 'secondary'}
        className="h-11 text-base"
        disabled={ending}
        onClick={submit}
      >
        {t.exam.submit}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.exam.unansweredTitle(unanswered)}</AlertDialogTitle>
            <AlertDialogDescription>{t.exam.unansweredBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.exam.keepGoing}</AlertDialogCancel>
            <AlertDialogAction onClick={end}>{t.exam.confirmSubmit}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
