import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';
import { LOCALE_TAGS } from '@/i18n/locales';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { EXAM_SIZE, examPassed, examResultsPath, type FinishedExam } from '@/model';

/** Finished exams, newest first, each with its date, score out of 20 and outcome, linking to its results (D11, D19). */
export function PastExams({ exams }: { exams: readonly FinishedExam[] }) {
  const { t, locale } = useI18n();
  return (
    <section aria-labelledby="progress-exams" className="flex flex-col gap-3">
      <h2 id="progress-exams" className="text-sm font-medium text-muted-foreground">
        {t.progress.exams}
      </h2>
      {exams.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.progress.noExams}</p>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y divide-border">
            {exams.map((exam) => {
              const { score } = exam;
              const passed = examPassed(score);
              const outcome = passed ? t.progress.passed : t.progress.notPassed;
              const date = new Date(exam.finishedAt).toLocaleDateString(LOCALE_TAGS[locale], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              return (
                <li key={exam.id}>
                  <Link
                    to={examResultsPath(exam.id)}
                    aria-label={t.progress.examRow(date, score, EXAM_SIZE, outcome)}
                    className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-medium tabular-nums">{t.progress.score(score, EXAM_SIZE)}</span>
                      <span className="text-sm text-muted-foreground">{date}</span>
                    </span>
                    <span className={cn('shrink-0 text-sm font-medium', passed ? 'text-success' : 'text-destructive')}>
                      {outcome}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
