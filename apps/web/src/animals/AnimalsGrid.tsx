import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useI18n } from '@/i18n/useI18n';

/** The Animals screen at /animals (D4, D6): the grid of 19 photo tiles and the Photo credits link at its foot. */
export function AnimalsGrid() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.animals.title} />
    </section>
  );
}
