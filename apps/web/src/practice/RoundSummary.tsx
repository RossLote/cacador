import { ChevronRight } from 'lucide-react';
import { PLATE } from '@/components/styles';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

/**
 * The score at the end of a round (DESIGN.md § 6.4), in place of the question
 * card: a plate captioned Round done, the count right in Fraunces 64 px with
 * "of N right" beside it, and under it the rust button for another round of
 * the same size. The screen header's back control and the tab bar are the way
 * out.
 */
export function RoundSummary({ right, size, onAnother }: { right: number; size: number; onAnother: () => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="round-done" className={cn('flex flex-col gap-2.5', PLATE)}>
      <h2 id="round-done" className="eyebrow">
        {t.practice.round.done}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-[64px] leading-none font-semibold tabular-nums">{right}</span>{' '}
        <span className="text-[15px] text-muted-foreground tabular-nums">{t.practice.round.ofRight(size)}</span>
      </p>
      <Button type="button" size="lg" className="mt-2 h-13 w-full text-[17px]" onClick={onAnother}>
        {t.practice.round.another(size)}
        <ChevronRight aria-hidden="true" />
      </Button>
    </section>
  );
}
