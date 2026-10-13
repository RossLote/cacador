import { useI18n } from '@/i18n/useI18n';
import type { RandomSource } from '@/model';
import { PracticeSession } from './PracticeSession';
import { usePracticePool } from './usePracticePool';

export interface PracticePageProps {
  /** Injectable for tests; Math.random otherwise. */
  random?: RandomSource;
}

/**
 * The Practice screen (DESIGN.md § 6.4) at /practice. The pool comes from
 * usePracticePool; focused practice (cac-eil.14) adds its chip under the
 * heading and its flags row through PracticeSession's afterResult.
 */
export function PracticePage({ random }: PracticePageProps) {
  const { t } = useI18n();
  const pool = usePracticePool();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t.practice.title}</h1>
      <PracticeSession pool={pool} random={random} />
    </div>
  );
}
