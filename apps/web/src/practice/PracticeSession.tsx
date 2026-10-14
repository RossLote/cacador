import { questionById, type OptionKey, type Question } from '@cacador/data';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FailureLine } from '@/components/FailureLine';
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

/** A check that stays true until `generation` moves on (a new pool, or the page gone). */
function staysCurrent(generation: { readonly current: number }): () => boolean {
  const at = generation.current;
  return () => generation.current === at;
}

/**
 * The practice loop (DESIGN.md § 6.4): one question drawn by weight from the
 * pool outside the recent window; tapping an option (or A, B, C, 1, 2, 3)
 * records it and reveals the result at once; Next (or Enter) draws the next.
 * The hint panel opens only when asked and closes on Next (D23); the peek is
 * shared by the card's hold button and Space (D9). Once answered, the flags
 * row (D2) shows under the result. `pool` is the ids to draw from
 * (usePracticePool); a new array starts a new draw, and a draw under way for
 * the old pool, or for a page that has gone, draws nothing. An answer that
 * cannot be written keeps its result on screen, says in one line that it was
 * not saved (DESIGN.md § 6.9), and Next still draws.
 *
 * `header` draws what sits above the card for the question on screen
 * (undefined while none is): the page's screen header, with the section ·
 * topic and the number (D6). It stays outside the keys' region, so the back
 * control keeps its own keys.
 */
export function PracticeSession({
  pool,
  header,
}: {
  pool: readonly number[];
  header: (question: Question | undefined) => ReactNode;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState<Shown>();
  const [peeking, setPeeking] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  /** Storage could not be read, so no question could be drawn (DESIGN.md § 6.9). */
  const [failed, setFailed] = useState(false);
  /** The answer on screen could not be written (DESIGN.md § 6.9). */
  const [answerNotSaved, setAnswerNotSaved] = useState(false);
  /** The answer being written; the next draw waits for it, so its weights count it. */
  const recording = useRef<Promise<unknown>>(Promise.resolve());
  /** The draw already answered, so a second tap or key in the same frame records nothing. */
  const answeredDraw = useRef<Shown>(undefined);
  const advancing = useRef(false);
  const top = useRef<HTMLDivElement>(null);
  /** Changes whenever the pool changes or the page goes, so a draw begun before then can tell it is stale. */
  const generation = useRef(0);

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
    setAnswerNotSaved(false);
  }, []);

  useEffect(() => {
    const isCurrent = staysCurrent(generation);
    void drawNext(isCurrent).then(
      (id) => {
        if (isCurrent() && id !== undefined) show(id);
      },
      () => {
        if (isCurrent()) setFailed(true);
      },
    );
    return () => {
      generation.current += 1;
    };
  }, [drawNext, show]);

  const question = shown && questionById(shown.id);
  const answered = shown?.selected !== undefined;

  const answer = useCallback(
    (option: OptionKey) => {
      if (shown === undefined || question === undefined || answeredDraw.current === shown) return;
      answeredDraw.current = shown;
      setShown({ id: shown.id, selected: option });
      // The next draw waits for this write and then shows the next question, so a failure always lands first.
      recording.current = recordAnswer({
        questionId: shown.id,
        chosen: option,
        mode: 'practice',
      }).catch(() => setAnswerNotSaved(true));
    },
    [shown, question],
  );

  const next = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    const isCurrent = staysCurrent(generation);
    void drawNext(isCurrent)
      .then(
        (id) => {
          if (!isCurrent() || id === undefined) return;
          show(id);
          if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
          top.current?.focus({ preventScroll: true });
        },
        () => {
          if (isCurrent()) setFailed(true);
        },
      )
      .finally(() => {
        advancing.current = false;
      });
  }, [drawNext, show]);

  usePracticeKeys({ answered, onAnswer: answer, onNext: next, onPeekChange: setPeeking, region: top });

  if (failed || question === undefined) {
    return (
      <>
        {header(undefined)}
        <p role="status" className="text-muted-foreground">
          {failed ? t.practice.loadFailed : t.practice.loading}
        </p>
      </>
    );
  }

  return (
    <>
      {header(question)}
      <div ref={top} tabIndex={-1} className="flex flex-col gap-3.5 outline-none">
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
        />
        {answerNotSaved && <FailureLine>{t.practice.answerNotSaved}</FailureLine>}
        {answered && (
          <div className="mt-1 flex flex-col gap-2.5">
            <FlagsRow key={question.id} questionId={question.id} />
            <Button type="button" size="lg" className="h-13 w-full text-[17px]" onClick={next}>
              {t.practice.next}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
