import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { PLATE } from '@/components/styles';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RoundSummaryProps {
  /** The plate's caption, "Round done", which names the region. */
  heading: string;
  /** How many were answered right, in Fraunces 64 px. */
  right: number;
  /** Beside the count: "of 10 right". */
  ofRight: string;
  /** The rust button's words: "Another 10". */
  another: string;
  onAnother: () => void;
  /** Between the count and the button: the words drill's list of the round's words. */
  children?: ReactNode;
}

/**
 * The score at the end of a round (DESIGN.md § 6.4, § 6.11), in place of the
 * card: a plate captioned Round done, the count right in Fraunces 64 px with
 * "of N right" beside it, and under it the rust button for another round of
 * the same size. Practice's round and the words drill each pass their own
 * words. The screen header's back control and the tab bar are the way out.
 */
export function RoundSummary({ heading, right, ofRight, another, onAnother, children }: RoundSummaryProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-2.5', PLATE)}>
      <h2 id={headingId} className="eyebrow">
        {heading}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-[64px] leading-none font-semibold tabular-nums">{right}</span>{' '}
        <span className="text-[15px] text-muted-foreground tabular-nums">{ofRight}</span>
      </p>
      {children}
      <Button type="button" size="lg" className="mt-2 h-13 w-full text-[17px]" onClick={onAnother}>
        {another}
        <ChevronRight aria-hidden="true" />
      </Button>
    </section>
  );
}
