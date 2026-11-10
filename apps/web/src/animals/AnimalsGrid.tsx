import { animals, type Animal } from '@cacador/data';
import { useState } from 'react';
import { Link } from 'react-router';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { FOCUS_RING } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { percentTone } from '@/progress/groups';
import { animalImageUrl } from '@/pwa/animalImages';
import { readAnimals, type AnimalProgress } from '@/storage';

/** The chip on a photo's bottom right corner: 5 px in, 6 px corners. */
const CHIP_BOX = 'absolute right-[5px] bottom-[5px] rounded-sm border px-[7px] py-[3px] font-semibold tabular-nums';

/**
 * One tile (D7, D12, D13, D17, D23): a link to the animal's pass, its photo in
 * a square with the chip on the corner, the Portuguese tile name over the
 * English, the same in either interface language (D14, D16). A kept pass shows
 * "12 of 34" in a clay chip, even when the animal also has a score; else the
 * last full pass's "17/22" in a card chip, forest at 75 % or more and rust
 * below, as Progress colours a percentage; else no chip.
 */
function AnimalTile({ animal, progress }: { animal: Animal; progress: AnimalProgress | undefined }) {
  const { t } = useI18n();
  const { slug, pt, en, position } = animal;
  const total = animal.questionIds.length;
  const pass = progress?.pass;
  const last = progress?.last;
  const src = animalImageUrl(slug);

  let label = t.animals.tileName(pt, en);
  let chip = null;
  if (pass !== undefined) {
    label = t.animals.tileStarted(pt, en, pass.answered, total);
    chip = (
      <span className={cn(CHIP_BOX, 'border-rust bg-clay text-[13px]/[1.2] text-ink')}>
        {t.animals.tilePartway(pass.answered, total)}
      </span>
    );
  } else if (last !== undefined) {
    label = t.animals.tileDone(pt, en, last.right, last.total);
    const tone = percentTone(Math.round((100 * last.right) / last.total));
    chip = (
      <span
        className={cn(
          CHIP_BOX,
          'border-line bg-card font-heading text-[15px]/[1.1]',
          tone === 'rust' ? 'text-rust' : 'text-forest',
        )}
      >
        {t.animals.tileScore(last.right, last.total)}
      </span>
    );
  }

  return (
    <Link
      to={`/animals/${slug}`}
      aria-label={label}
      className={cn('flex flex-col gap-1.5 rounded-lg text-ink', FOCUS_RING)}
    >
      <span className="relative block aspect-square overflow-hidden rounded-lg border border-line bg-muted">
        {src !== undefined && (
          <img src={src} alt="" className="block size-full object-cover" style={{ objectPosition: position }} />
        )}
        {chip}
      </span>
      <span className="flex flex-col gap-px px-0.5">
        <span lang="pt-PT" className="text-[15px]/[1.2] font-semibold">
          {pt}
        </span>
        <span lang="en" className="text-[13px]/[1.25] text-muted-foreground">
          {en}
        </span>
      </span>
    </Link>
  );
}

/**
 * The Animals screen at /animals (D4, D6): the 19 animals as photo tiles three
 * wide at every width, in the data's order, and the Photo credits link at its
 * foot (D8). The scores and kept passes are read as the screen mounts, so
 * coming back from a pass shows its chip (D21).
 */
export function AnimalsGrid() {
  const { t } = useI18n();
  const [progress] = useState(readAnimals);
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.animals.title} />
      <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4">
        {animals.map((animal) => (
          <li key={animal.slug}>
            <AnimalTile animal={animal} progress={progress[animal.slug]} />
          </li>
        ))}
      </ul>
      <Link
        to="/animals/credits"
        className={cn(
          'inline-flex min-h-11 items-center self-start rounded-md text-sm font-semibold text-forest hover:text-ink',
          FOCUS_RING,
        )}
      >
        {t.animals.credits}
      </Link>
    </section>
  );
}
