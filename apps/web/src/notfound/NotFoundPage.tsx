import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useI18n } from '@/i18n/useI18n';

/**
 * Any address under /cacador/ that names no screen (a typo, a stale link): a
 * heading and one line, under its header with the back control to Home, rather
 * than a blank page.
 */
export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.common.notFound.title} />
      <p className="text-muted-foreground">{t.common.notFound.body}</p>
    </section>
  );
}
