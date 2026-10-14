import { Link } from 'react-router';
import { ROW_LINK } from '@/components/styles';
import { Badge } from '@/components/ui/badge';
import { LOCALE_TAGS } from '@/i18n/locales';
import { useI18n } from '@/i18n/useI18n';
import { EXAM_SIZE, examPassed, examResultsPath, scoreExam, type FinishedExam } from '@/model';

/**
 * Finished exams, newest finished first, each with its date, score out of 20
 * and outcome, linking to its results (D11, D19). The score is worked out from
 * the exam's answers, as the results page does, not the one stored at Submit,
 * which an answer-key correction or an import can leave behind.
 */
export function PastExams({ exams }: { exams: readonly FinishedExam[] }) {
  const { t, locale } = useI18n();
  return (
    <section aria-labelledby="progress-exams" className="flex flex-col gap-2">
      <h2 id="progress-exams" className="eyebrow">
        {t.progress.exams}
      </h2>
      {exams.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.progress.noExams}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {exams.map((exam) => {
            const score = scoreExam(exam);
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
                  className={ROW_LINK}
                >
                  <span className="min-w-0 flex-1 text-base font-semibold">{date}</span>
                  <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                    {t.progress.score(score, EXAM_SIZE)}
                  </span>
                  <Badge variant={passed ? 'success' : 'destructive'}>{outcome}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
