import type { Word } from '@cacador/data';
import { X } from 'lucide-react';
import { RoundSummary } from '@/components/round/RoundSummary';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

/**
 * The score at the end of a words round (DESIGN.md § 6.11), in place of the
 * card: Practice's round score (RoundSummary) with the round's words between
 * the count and the button, in the order shown, each its Portuguese over its
 * English, a missed one on clay with a rust hairline, a rust cross and
 * "Missed" in ink (§ 8.5). `right` holds, word by word, whether it was
 * answered right.
 */
export function WordsSummary({
  words,
  right,
  onAnother,
}: {
  words: readonly Word[];
  right: readonly boolean[];
  onAnother: () => void;
}) {
  const { t } = useI18n();
  return (
    <RoundSummary
      heading={t.words.done}
      right={right.filter(Boolean).length}
      ofRight={t.words.ofRight(words.length)}
      another={t.words.another(words.length)}
      onAnother={onAnother}
    >
      <ol className="mt-1 flex flex-col gap-2">
        {words.map((word, i) => {
          const missed = right[i] !== true;
          return (
            <li
              key={word.pt}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md border px-3.5 py-2.5 text-ink',
                missed ? 'border-rust bg-clay' : 'border-line bg-card',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span lang="pt-PT" className="font-heading text-[17px]/[1.25] font-semibold">
                  {word.pt}
                </span>{' '}
                <span lang="en" className="text-[15px]/[1.35]">
                  {word.en}
                </span>
              </span>
              {missed && (
                <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold">
                  <X aria-hidden="true" className="size-5 text-rust" strokeWidth={1.75} />
                  {t.words.missed}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </RoundSummary>
  );
}
