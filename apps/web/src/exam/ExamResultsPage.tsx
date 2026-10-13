import { questionById, type OptionKey, type Question } from '@cacador/data';
import { Check, X } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { useParams } from 'react-router';
import { LinkButton } from '@/components/LinkButton';
import { QuestionCard } from '@/components/question/QuestionCard';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { cn } from '@/lib/utils';
import { EXAM_PASS_MARK, examPassed, examResults, isFinished, scoreExam, type FinishedExam } from '@/model';
import { getExam } from '@/storage';

/** The exam with this id once it is finished: null when there is none or it is still running, undefined while storage is read; `failed` when it cannot be read. */
function useFinishedExam(id: string | undefined): { exam: FinishedExam | null | undefined; failed: boolean } {
  const load = useCallback(async (): Promise<FinishedExam | null> => {
    if (id === undefined) return null;
    const exam = await getExam(id);
    return exam !== undefined && isFinished(exam) ? exam : null;
  }, [id]);
  const { data, failed } = useLoaded(load);
  return { exam: data, failed };
}

interface WrongAnswer {
  question: Question;
  /** The option chosen; absent when the question was left unanswered. */
  chosen?: OptionKey;
}

/** One wrong answer on the card revealed and locked, with its own peek and hint (D20); the peek is the card's hold button only. */
function ReviewCard({ question, chosen }: WrongAnswer) {
  const { t } = useI18n();
  const [peeking, setPeeking] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <li className="flex flex-col gap-3 py-6 first:pt-0 last:pb-0">
      {chosen === undefined && <p className="text-sm font-medium text-destructive">{t.exam.notAnswered}</p>}
      <QuestionCard
        question={question}
        selected={chosen}
        revealed
        locked
        peekEnabled
        peeking={peeking}
        onPeekChange={setPeeking}
        hintEnabled
        hintOpen={hintOpen}
        onHintOpen={() => setHintOpen(true)}
      />
    </li>
  );
}

/**
 * The score out of 20 against the pass mark, and Passed or Not passed (D3),
 * worked out from the exam's answers with today's key, as the list of wrong
 * ones is, so the two always agree; the stored score is not shown.
 */
function ScorePanel({ exam }: { exam: FinishedExam }) {
  const { t } = useI18n();
  const score = scoreExam(exam);
  const passed = examPassed(score);
  const Icon = passed ? Check : X;
  return (
    <section aria-label={t.exam.scoreLabel} className="flex flex-col gap-2">
      <p className="text-5xl font-semibold tracking-tight tabular-nums">{t.exam.score(score, exam.questionIds.length)}</p>
      <p className={cn('flex items-center gap-2 text-xl font-semibold', passed ? 'text-success' : 'text-destructive')}>
        <Icon aria-hidden="true" className="size-6" />
        {passed ? t.exam.passed : t.exam.notPassed}
      </p>
      <p className="text-muted-foreground tabular-nums">{t.exam.passMark(EXAM_PASS_MARK)}</p>
    </section>
  );
}

/** The wrong ones, unanswered included, in exam order, each on its own card. */
function WrongAnswers({ exam }: { exam: FinishedExam }) {
  const { t } = useI18n();
  const headingId = useId();
  const wrong = examResults(exam).flatMap(({ questionId, chosen, correct }): WrongAnswer[] => {
    const question = correct ? undefined : questionById(questionId);
    return question ? [{ question, chosen }] : [];
  });
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-lg font-semibold tracking-tight">
        {t.exam.wrongAnswers}
      </h2>
      {wrong.length === 0 ? (
        <p className="text-muted-foreground">{t.exam.noWrongAnswers}</p>
      ) : (
        <ol aria-label={t.exam.wrongAnswers} className="flex flex-col divide-y">
          {wrong.map(({ question, chosen }) => (
            <ReviewCard key={question.id} question={question} chosen={chosen} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * /exam/results/<id> (DESIGN.md § 6.5, D3): a finished exam's score out of 20
 * against the pass mark, Passed or Not passed, and the wrong ones on the card
 * revealed and locked, the chosen and the correct option marked (only the
 * correct one when unanswered), with peek and Hint, no keys and no flags row
 * (D2). An id that is not a finished exam says so.
 */
export function ExamResultsPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const { exam, failed } = useFinishedExam(id);

  if (!exam) {
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
            <p className="text-lg leading-snug">{t.exam.notFound}</p>
            <LinkButton to="/exam" variant="outline" size="lg" className="h-11 text-base sm:self-start">
              {t.exam.toExam}
            </LinkButton>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.exam.resultsTitle}</h1>
        <ScorePanel exam={exam} />
      </div>
      <WrongAnswers exam={exam} />
    </div>
  );
}
