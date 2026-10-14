import type { Question } from '@cacador/data';
import { Badge } from '@/components/ui/badge';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { nameIn, placeOf } from '@/components/question/names';
import { useI18n } from '@/i18n/useI18n';
import { PracticeSession } from './PracticeSession';
import { usePracticePool } from './usePracticePool';

/**
 * The Practice screen (DESIGN.md § 6.4) at /practice. The screen header names
 * the question on screen, its section · topic over "Question N" (D6), and the
 * screen's name until one is drawn; the page's heading is for screen readers
 * only. The pool comes from usePracticePool (the whole bank, or the group
 * named by ?topic=, ?section= or ?pattern=, which a chip under the header
 * names); once a question is answered the flags row (D2) shows under its
 * result.
 */
export function PracticePage() {
  const { t, locale } = useI18n();
  const { pool, group } = usePracticePool();
  const header = (question: Question | undefined) => (
    <>
      <ScreenHeader
        eyebrow={question ? placeOf(question, locale) : t.common.nav.practice}
        line={question && t.practice.card.questionNumber(question.id)}
        heading={t.practice.title}
      />
      {group !== undefined && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.practice.focusedOn}
          <Badge variant="secondary" className="rounded-md">
            {nameIn(group, locale)}
          </Badge>
        </p>
      )}
    </>
  );
  return (
    <div className="flex flex-col gap-3.5">
      <PracticeSession pool={pool} header={header} />
    </div>
  );
}
