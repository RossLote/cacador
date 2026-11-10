import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useI18n } from '@/i18n/useI18n';

/** The photo credits at /animals/credits (D8, D19): one line, then a row per animal with author, licence and source. */
export function AnimalCredits() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.animals.credits} />
    </section>
  );
}
