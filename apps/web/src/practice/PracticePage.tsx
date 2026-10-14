import { Badge } from '@/components/ui/badge';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { nameIn } from '@/components/question/names';
import { useI18n } from '@/i18n/useI18n';
import { PracticeSession } from './PracticeSession';
import { usePracticePool } from './usePracticePool';

/**
 * The Practice screen (DESIGN.md § 6.4) at /practice. The pool comes from
 * usePracticePool (the whole bank, or the group named by ?topic=, ?section=
 * or ?pattern=, which a chip under the heading names); once a question is
 * answered the flags row (D2) shows under its result.
 */
export function PracticePage() {
  const { t, locale } = useI18n();
  const { pool, group } = usePracticePool();
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader eyebrow={t.common.nav.practice} />
      <h1 className="text-xl font-semibold tracking-tight">{t.practice.title}</h1>
      {group !== undefined && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.practice.focusedOn}
          <Badge variant="secondary" className="rounded-md">
            {nameIn(group, locale)}
          </Badge>
        </p>
      )}
      <PracticeSession pool={pool} />
    </div>
  );
}
