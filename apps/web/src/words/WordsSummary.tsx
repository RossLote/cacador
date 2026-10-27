import type { Word } from '@cacador/data';
import { ChevronRight, X } from 'lucide-react';
import { useId } from 'react';
import { PLATE } from '@/components/styles';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

/**
 * The score at the end of a words round (DESIGN.md § 6.11), in place of the
 * card, in the look of Practice's round score: a plate captioned Round done,
 * the count right in Fraunces 64 px with "of 10 right" beside it, then the
 * round's words in the order shown, each its Portuguese over its English, a
 * missed one on clay with a rust hairline, a rust cross and "Missed" in ink
 * (§ 8.5), and the rust button for the next round. `right` holds, word by
 * word, whether it was answered right.
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
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-2.5', PLATE)}>
      <h2 id={headingId} className="eyebrow">
        {t.words.done}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-[64px] leading-none font-semibold tabular-nums">{right.filter(Boolean).length}</span>{' '}
        <span className="text-[15px] text-muted-foreground tabular-nums">{t.words.ofRight(words.length)}</span>
      </p>
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
      <Button type="button" size="lg" className="mt-2 h-13 w-full text-[17px]" onClick={onAnother}>
        {t.words.another(words.length)}
        <ChevronRight aria-hidden="true" />
      </Button>
    </section>
  );
}
