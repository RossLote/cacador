import { useId } from 'react';
import { LinkButton } from '@/components/LinkButton';
import { PLATE } from '@/components/styles';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

/** The score buttons' size: full width, 48 px tall, 17 px words (animal practice artboard 4). */
const SCORE_BUTTON = 'h-12 w-full text-[17px]';

/**
 * The score at the end of an animal's pass (animal practice D10, D18, D20), in
 * place of the card: a plate like RoundSummary's, captioned "<animal> done"
 * with the animal's tile name, the count right in Fraunces 64 px and "of N
 * right" beside it; under the plate, full width, Missed ones only (n) while any
 * were wrong, Go again, and the link Back to animals. One button is rust:
 * Missed ones only when there is one, Go again otherwise; Go again is then
 * outlined with the ink hairline, and Back to animals with the line hairline.
 */
export function AnimalSummary({
  name,
  right,
  total,
  missed,
  onMissedOnly,
  onAgain,
}: {
  /** The animal's Portuguese tile name (D16). */
  name: string;
  right: number;
  total: number;
  /** How many were answered wrongly. */
  missed: number;
  onMissedOnly: () => void;
  onAgain: () => void;
}) {
  const { t } = useI18n();
  const headingId = useId();
  return (
    <div className="flex flex-col gap-3.5">
      <section aria-labelledby={headingId} className={cn('flex flex-col gap-2.5', PLATE)}>
        <h2 id={headingId} className="eyebrow">
          {t.animals.done(name)}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-heading text-[64px] leading-none font-semibold tabular-nums">{right}</span>{' '}
          <span className="text-[15px] text-muted-foreground tabular-nums">{t.animals.ofRight(total)}</span>
        </p>
      </section>
      {missed > 0 && (
        <Button type="button" size="lg" className={SCORE_BUTTON} onClick={onMissedOnly}>
          {t.animals.missedOnly(missed)}
        </Button>
      )}
      <Button type="button" size="lg" variant={missed > 0 ? 'secondary' : 'default'} className={SCORE_BUTTON} onClick={onAgain}>
        {t.animals.again}
      </Button>
      <LinkButton to="/animals" size="lg" variant="outline" className={SCORE_BUTTON}>
        {t.animals.back}
      </LinkButton>
    </div>
  );
}
