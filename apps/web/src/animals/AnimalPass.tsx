import { animalBySlug } from '@cacador/data';
import { useParams } from 'react-router';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useI18n } from '@/i18n/useI18n';
import { NotFoundPage } from '@/notfound/NotFoundPage';

/** An animal's pass at /animals/<slug> (D3, D9, D21): every question about it once, then the score; an unknown slug is not found. */
export function AnimalPass() {
  const { t } = useI18n();
  const { slug = '' } = useParams();
  const animal = animalBySlug(slug);
  if (animal === undefined) return <NotFoundPage />;
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader eyebrow={t.animals.title} heading={t.animals.title} />
    </section>
  );
}
