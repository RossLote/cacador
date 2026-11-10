import { animalBySlug, questionById, type Animal, type OptionKey } from '@cacador/data';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { FailureLine } from '@/components/FailureLine';
import { useDock } from '@/components/nav/dock';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { QuestionCard } from '@/components/question/QuestionCard';
import { placeOf } from '@/components/question/names';
import { useAnswerKeys } from '@/components/question/useAnswerKeys';
import { RoundCounter } from '@/components/round/RoundCounter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { isCorrectOption } from '@/model';
import { NotFoundPage } from '@/notfound/NotFoundPage';
import { FlagsRow } from '@/practice/FlagsRow';
import { readAnimals, recordAnswer, recordPassAnswer, restartPass } from '@/storage';
import { AnimalSummary } from './AnimalSummary';

/** An animal's pass at /animals/<slug> (D3, D9, D21): every question about it once, then the score; an unknown slug is not found. */
export function AnimalPass() {
  const { slug = '' } = useParams();
  const animal = animalBySlug(slug);
  if (animal === undefined) return <NotFoundPage />;
  return <PassSession key={animal.slug} animal={animal} />;
}

/**
 * The questions being asked and how they have gone: a full pass over the
 * animal's questions (`full`), or a pass over the ones a score counted wrong
 * (Missed ones only, D20), which is never kept and never reaches the animal's score.
 */
interface Run {
  full: boolean;
  ids: readonly number[];
  /** Answered right so far in this run, a kept pass's included. */
  right: number;
  /** The ids answered wrongly so far, in the order asked. */
  missed: readonly number[];
}

/** The question on screen, by its place in the run, and once answered the option picked. A new object per question. */
interface Step {
  index: number;
  selected?: OptionKey;
}

/** A finished run's score. */
interface Score {
  right: number;
  total: number;
  missed: readonly number[];
}

/** The animal's full pass, carried on from its kept pass (D12) when there is one, from question 1 otherwise. */
function fullPass(animal: Animal): { run: Run; step: Step } {
  const kept = readAnimals()[animal.slug]?.pass;
  return {
    run: { full: true, ids: animal.questionIds, right: kept?.right ?? 0, missed: kept?.missed ?? [] },
    step: { index: kept?.answered ?? 0 },
  };
}

/**
 * The pass (D3, D9, D10, D12, D14, D20): the animal's questions in the bank's
 * order on Practice's question card, peek, Hint, dock, keys and flags row
 * included, the screen header naming the question with its place in the pass
 * at the right ("3 of 22"), and a chip "Practising <tile name>" under it. Each
 * answer goes to the answers log as a practice answer (D10) and, in a full
 * pass, to the animal's kept pass (D12, D22), which records the score at the
 * last answer. Finish puts the score in place of the card, from which Missed
 * ones only asks the wrong ones again and Go again starts a full pass from
 * question 1. An answer that cannot be written says so in Practice's words,
 * and the pass moves on all the same.
 */
function PassSession({ animal }: { animal: Animal }) {
  const { t, locale } = useI18n();
  const [start] = useState(() => fullPass(animal));
  const [run, setRun] = useState<Run>(start.run);
  /** Undefined while the score is on screen. */
  const [step, setStep] = useState<Step | undefined>(start.step);
  const [score, setScore] = useState<Score>();
  const [peeking, setPeeking] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [answerNotSaved, setAnswerNotSaved] = useState(false);
  /** The answer being written; Next waits for it, so a failure always shows under its own answer. */
  const recording = useRef<Promise<unknown>>(Promise.resolve());
  /** The step already answered, so a second tap or key in the same frame records nothing. */
  const answeredStep = useRef<Step>(undefined);
  /** A full pass's score as storage recorded it at the last answer (`recordPassAnswer`'s finished result). */
  const passScore = useRef<Score>(undefined);
  const advancing = useRef(false);
  /** Moves on when the page goes, so a Next under way then does nothing. */
  const generation = useRef(0);
  const top = useRef<HTMLDivElement>(null);
  /** A new run from the score: its region takes the focus once it is on screen. */
  const focusNewRun = useRef(false);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const questionId = step && run.ids[step.index];
  const question = questionId === undefined ? undefined : questionById(questionId);
  const answered = step?.selected !== undefined;
  const last = step !== undefined && step.index === run.ids.length - 1;

  const answer = useCallback(
    (option: OptionKey) => {
      if (step === undefined || questionId === undefined || answeredStep.current === step) return;
      answeredStep.current = step;
      const correct = isCorrectOption(questionId, option);
      setStep({ index: step.index, selected: option });
      setRun((was) => ({
        ...was,
        right: was.right + (correct ? 1 : 0),
        missed: correct ? was.missed : [...was.missed, questionId],
      }));
      recording.current = recordAnswer({ questionId, chosen: option, mode: 'practice' }).catch(() => setAnswerNotSaved(true));
      if (run.full) {
        const result = recordPassAnswer(animal.slug, correct);
        passScore.current = result.finished
          ? { right: result.score.right, total: result.score.total, missed: result.missed }
          : undefined;
      }
    },
    [animal.slug, questionId, run.full, step],
  );

  /** The next question of the run, once the answer on screen is written; the hint panel closes (D23). */
  const next = useCallback(() => {
    if (step === undefined || advancing.current) return;
    advancing.current = true;
    const at = generation.current;
    void recording.current.finally(() => {
      advancing.current = false;
      if (generation.current !== at) return;
      setStep({ index: step.index + 1 });
      setHintOpen(false);
      setAnswerNotSaved(false);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      top.current?.focus({ preventScroll: true });
    });
  }, [step]);

  /** The run's last answer is on screen: puts the score in its place. */
  const finish = useCallback(() => {
    setScore(
      run.full && passScore.current !== undefined
        ? passScore.current
        : { right: run.right, total: run.ids.length, missed: run.missed },
    );
    setStep(undefined);
    setHintOpen(false);
    setAnswerNotSaved(false);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [run]);

  /** Starts `fresh` at its first question in place of the score. */
  const begin = useCallback((fresh: Run) => {
    passScore.current = undefined;
    focusNewRun.current = true;
    setRun(fresh);
    setStep({ index: 0 });
    setScore(undefined);
  }, []);

  useEffect(() => {
    if (!focusNewRun.current || step === undefined) return;
    focusNewRun.current = false;
    top.current?.focus({ preventScroll: true });
  }, [step]);

  const dock = useDock();
  useAnswerKeys({ answered, onAnswer: answer, onNext: last ? finish : next, onPeekChange: setPeeking, region: top, dock });

  if (score !== undefined || question === undefined) {
    const total = score?.total ?? run.ids.length;
    return (
      <div className="flex flex-col gap-3.5">
        <ScreenHeader
          eyebrow={t.animals.title}
          aside={<RoundCounter label={t.animals.position(total, total)} />}
          heading={t.animals.title}
        />
        {score !== undefined && (
          <AnimalSummary
            name={animal.pt}
            agreement={animal.ptAgreement}
            right={score.right}
            total={score.total}
            missed={score.missed.length}
            onMissedOnly={() => begin({ full: false, ids: score.missed, right: 0, missed: [] })}
            onAgain={() => {
              restartPass(animal.slug);
              begin({ full: true, ids: animal.questionIds, right: 0, missed: [] });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenHeader
        eyebrow={placeOf(question, locale)}
        line={t.practice.card.questionNumber(question.id)}
        aside={<RoundCounter label={t.animals.position((step?.index ?? 0) + 1, run.ids.length)} />}
        heading={t.animals.title}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {t.animals.practising}
        <Badge variant="secondary" lang="pt-PT">
          {animal.pt}
        </Badge>
      </p>
      <div ref={top} tabIndex={-1} className="flex flex-col gap-3.5 outline-none">
        <QuestionCard
          question={question}
          selected={step?.selected}
          revealed={answered}
          locked={answered}
          onSelect={answer}
          peekEnabled
          peeking={peeking}
          onPeekChange={setPeeking}
          hintEnabled
          hintOpen={hintOpen}
          onHintOpen={() => setHintOpen(true)}
          docked
        />
        {answerNotSaved && <FailureLine>{t.animals.answerNotSaved}</FailureLine>}
        {answered && (
          <div className="mt-1 flex flex-col gap-2.5">
            <FlagsRow key={question.id} questionId={question.id} />
            <Button type="button" size="lg" className="h-13 w-full text-[17px]" onClick={last ? finish : next}>
              {last ? t.animals.finish : t.animals.next}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
