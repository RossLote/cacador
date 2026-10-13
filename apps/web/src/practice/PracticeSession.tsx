import { questionById, type OptionKey } from '@cacador/data';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuestionCard } from '@/components/question/QuestionCard';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { getStates, recordAnswer } from '@/storage';
import { FlagsRow } from './FlagsRow';
import { drawPracticeQuestion } from './recent';
import { usePracticeKeys } from './usePracticeKeys';

/** The question on screen and, once answered, the option picked. A new object per draw. */
interface Shown {
  id: number;
  selected?: OptionKey;
}

/**
 * The practice loop (DESIGN.md § 6.4): one question drawn by weight from the
 * pool outside the recent window; tapping an option (or A, B, C, 1, 2, 3)
 * records it and reveals the result at once; Next (or Enter) draws the next.
 * The hint panel opens only when asked and closes on Next (D23); the peek is
 * shared by the card's hold button and Space (D9). Once answered, the flags
 * row (D2) shows under the result. `pool` is the ids to draw from
 * (usePracticePool); a new array starts a new draw.
 */
export function PracticeSession({ pool }: { pool: readonly number[] }) {
  const { t } = useI18n();
  const [shown, setShown] = useState<Shown>();
  const [peeking, setPeeking] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  /** Storage could not be read, so no question could be drawn (DESIGN.md § 6.9). */
  const [failed, setFailed] = useState(false);
  /** The answer being written; the next draw waits for it, so its weights count it. */
  const recording = useRef<Promise<unknown>>(Promise.resolve());
  /** The draw already answered, so a second tap or key in the same frame records nothing. */
  const answeredDraw = useRef<Shown>(undefined);
  const advancing = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  /** The next id by the model's weights, once the last answer is written; nothing is drawn for a stale caller. */
  const drawNext = useCallback(
    async (isCurrent: () => boolean) => {
      await recording.current;
      const states = await getStates();
      return isCurrent() ? drawPracticeQuestion(pool, states) : undefined;
    },
    [pool],
  );

  /** A new question starts unanswered with the hint panel closed (D23). */
  const show = useCallback((id: number) => {
    setShown({ id });
    setHintOpen(false);
  }, []);

  useEffect(() => {
    let current = true;
    void drawNext(() => current).then(
      (id) => {
        if (current && id !== undefined) show(id);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [drawNext, show]);

  const question = shown && questionById(shown.id);
  const answered = shown?.selected !== undefined;

  const answer = useCallback(
    (option: OptionKey) => {
      if (shown === undefined || question === undefined || answeredDraw.current === shown) return;
      answeredDraw.current = shown;
      setShown({ id: shown.id, selected: option });
      recording.current = recordAnswer({
        questionId: shown.id,
        chosen: option,
        correct: option === question.answer,
        mode: 'practice',
      }).catch(() => undefined);
    },
    [shown, question],
  );

  const next = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    void drawNext(() => true)
      .then((id) => {
        if (id === undefined) return;
        show(id);
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
        top.current?.focus({ preventScroll: true });
      })
      .catch(() => setFailed(true))
      .finally(() => {
        advancing.current = false;
      });
  }, [drawNext, show]);

  usePracticeKeys({ answered, onAnswer: answer, onNext: next, onPeekChange: setPeeking, region: top });

  if (failed || question === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        {failed ? t.practice.loadFailed : t.practice.loading}
      </p>
    );
  }

  return (
    <div ref={top} tabIndex={-1} className="flex flex-col gap-4 outline-none">
      <QuestionCard
        question={question}
        selected={shown?.selected}
        revealed={answered}
        locked={answered}
        onSelect={answer}
        peekEnabled
        peeking={peeking}
        onPeekChange={setPeeking}
        hintEnabled
        hintOpen={hintOpen}
        onHintOpen={() => setHintOpen(true)}
        actions={
          answered && (
            <Button type="button" size="lg" className="min-w-28" onClick={next}>
              {t.practice.next}
              <ArrowRight aria-hidden="true" />
            </Button>
          )
        }
      />
      {answered && <FlagsRow key={question.id} questionId={question.id} />}
    </div>
  );
}
