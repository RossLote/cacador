import { animals } from '@cacador/data';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { FOCUS_RING } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { animalImageUrl } from '@/pwa/animalImages';

/**
 * The photo credits at /animals/credits (D8, D19): the line saying the photos
 * were resized and cropped, then a row per animal in the grid's order with its
 * thumbnail, its Portuguese tile name, the author and licence, and a link to
 * the photo's Wikimedia Commons page in a new tab.
 */
export function AnimalCredits() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.animals.credits} />
      <p className="text-sm text-muted-foreground">{t.animals.creditsIntro}</p>
      <ul className="flex flex-col gap-2">
        {animals.map(({ slug, pt, position, author, licence, source }) => {
          const src = animalImageUrl(slug);
          return (
            <li
              key={slug}
              className="flex items-center gap-3 rounded-md border border-line bg-card py-2 pr-3 pl-2 text-ink"
            >
              {src === undefined ? (
                <span className="size-11 shrink-0 rounded-sm bg-muted" />
              ) : (
                <img
                  src={src}
                  alt=""
                  className="size-11 shrink-0 rounded-sm object-cover"
                  style={{ objectPosition: position }}
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span lang="pt-PT" className="text-[15px]/[1.25] font-semibold">
                  {pt}
                </span>
                <span className="text-[13px]/[1.3] text-muted-foreground">{`${author} · ${licence}`}</span>
              </span>
              <a
                href={source}
                target="_blank"
                rel="noreferrer"
                aria-label={t.animals.sourceOf(pt)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-md text-sm font-semibold text-forest hover:text-ink',
                  FOCUS_RING,
                )}
              >
                {t.animals.source}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
