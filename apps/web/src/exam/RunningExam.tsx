import { questionById, type OptionKey } from '@cacador/data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { FailureLine } from '@/components/FailureLine';
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
import { examResultsPath } from '@/model';
import { finishExam, getExam, saveExamAnswer, type Exam } from '@/storage';
import { ExamMarkers } from './ExamMarkers';
import { formatClock, useExamClock } from './useExamClock';

/** The countdown on its own, so only it re-renders every second; calls `onExpire` at 00:00. */
function ExamClock({ exam, onExpire }: { exam: Exam; onExpire: () => void }) {
  const { t } = useI18n();
  const left = useExamClock(exam, onExpire);
  return (
    <p role="timer" aria-label={t.exam.timeLeft} className="text-2xl font-semibold tabular-nums">
      {formatClock(left)}
    </p>
  );
}

/** Where a resumed exam opens: its first unanswered question, or the first when all are answered. */
function firstUnanswered(exam: Exam): number {
  const index = exam.questionIds.findIndex((id) => exam.answers[id] === undefined);
  return Math.max(0, index);
}

/** A tapped option whose save has not settled; each tap is its own object, so a later tap on the same question replaces it. */
interface Tap {
  option: OptionKey;
}

/** What the page's one failure line reports (DESIGN.md § 6.9): an answer that was not saved, or a Submit that did not go through. */
type Failure = 'answer' | 'submit';

/**
 * The running mock exam (DESIGN.md § 6.5, D3): one question at a time on the
 * card with the selection shown and nothing revealed, no peek, no hint and no
 * keys (D9, D20); markers, Previous and Next move freely; every answer change
 * is saved at once, checked against the deadline at the moment of the tap;
 * the clock counts down from the start time. Submit, after asking when
 * questions are unanswered, and the clock reaching zero both finish the exam
 * through the storage module's once-only finish and open its results, whether
 * this page's finish ran or an earlier one had. What the page shows is what
 * Submit scores: an answer the storage module rejects is taken back to the
 * stored exam, read again, and a Submit that fails stays here; either says so
 * in one line (DESIGN.md § 6.9), and Submit can be pressed again.
 */
export function RunningExam({ exam }: { exam: Exam }) {
  const { t } = useI18n();
  /** The answers as last saved or read back: what Submit will score. */
  const [stored, setStored] = useState<Record<number, OptionKey>>(exam.answers);
  /** Options tapped whose save has not settled yet, by question; shown over the stored ones. */
  const [pending, setPending] = useState<Record<number, Tap>>({});
  const [current, setCurrent] = useState(() => firstUnanswered(exam));
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [failure, setFailure] = useState<Failure>();
  /** The exam is finished: the page opens its results. Set after the page has gone, it is dropped, so the learner stays where they went. */
  const [done, setDone] = useState(false);
  /** The answer saves in order; the finish waits for the last. Never rejects. */
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const ended = useRef(false);

  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    setEnding(true);
    setConfirming(false);
    setFailure(undefined);
    void saving.current
      .then(() => finishExam(exam.id))
      .then(
        () => setDone(true),
        () => {
          // Not submitted: the exam stays open here, and Submit may run again, the finish being once-only.
          ended.current = false;
          setEnding(false);
          setFailure('submit');
        },
      );
  }, [exam.id]);

  /** Takes the screen back to the exam as stored; one finished meanwhile, here or elsewhere, ends the page. */
  const reread = useCallback(async () => {
    const now = await getExam(exam.id);
    if (now === undefined || now.finishedAt !== undefined) end();
    else setStored(now.answers);
  }, [exam.id, end]);

  const total = exam.questionIds.length;
  const questionId = exam.questionIds[current] as number;
  const question = questionById(questionId);
  const answers: Record<number, OptionKey> = { ...stored };
  for (const id of exam.questionIds) {
    const tap = pending[id];
    if (tap) answers[id] = tap.option;
  }
  const unanswered = exam.questionIds.filter((id) => answers[id] === undefined).length;

  /** Drops the question's pending tap once its save has settled, unless a later tap has replaced it. */
  const settle = (id: number, tap: Tap) =>
    setPending((taps) => {
      if (taps[id] !== tap) return taps;
      const rest = { ...taps };
      delete rest[id];
      return rest;
    });

  const select = (option: OptionKey) => {
    if (ended.current) return;
    // The deadline is checked against the tap, not against when a queued save reaches storage.
    const at = Date.now();
    const id = questionId;
    const tap: Tap = { option };
    setFailure(undefined);
    setPending((taps) => ({ ...taps, [id]: tap }));
    saving.current = saving.current
      .then(() => saveExamAnswer(exam.id, id, option, at))
      .then(
        (saved) => {
          settle(id, tap);
          if (saved) setStored((answers) => ({ ...answers, [id]: option }));
          // Refused: the exam was finished elsewhere or its time is up, so it ends here too.
          else end();
        },
        () => {
          settle(id, tap);
          setFailure('answer');
          return reread();
        },
      )
      // A failed read back leaves the answers last known to be stored on screen.
      .catch(() => undefined);
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
      {done && <Navigate to={examResultsPath(exam.id)} replace />}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.exam.title}</h1>
        <p className="text-muted-foreground tabular-nums">{t.exam.position(current + 1, total)}</p>
        <ExamClock exam={exam} onExpire={end} />
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

      {failure && <FailureLine>{failure === 'answer' ? t.exam.answerNotSaved : t.exam.submitFailed}</FailureLine>}

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
