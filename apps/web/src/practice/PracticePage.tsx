import { Badge } from '@/components/ui/badge';
import { nameIn } from '@/components/question/names';
import { useI18n } from '@/i18n/useI18n';
import type { RandomSource } from '@/model';
import { FlagsRow } from './FlagsRow';
import { PracticeSession } from './PracticeSession';
import { usePracticePool } from './usePracticePool';

export interface PracticePageProps {
  /** Injectable for tests; Math.random otherwise. */
  random?: RandomSource;
}

/**
 * The Practice screen (DESIGN.md § 6.4) at /practice. The pool comes from
 * usePracticePool (the whole bank, or the group named by ?topic=, ?section=
 * or ?pattern=, which a chip under the heading names); once a question is
 * answered the flags row (D2) shows under its result.
 */
export function PracticePage({ random }: PracticePageProps) {
  const { t, locale } = useI18n();
  const { pool, group } = usePracticePool();
  const groupName = nameIn(group, locale);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t.practice.title}</h1>
      {groupName !== undefined && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.practice.focusedOn}
          <Badge variant="secondary" className="rounded-md">
            {groupName}
          </Badge>
        </p>
      )}
      <PracticeSession pool={pool} random={random} afterResult={(id) => <FlagsRow key={id} questionId={id} />} />
    </div>
  );
}
