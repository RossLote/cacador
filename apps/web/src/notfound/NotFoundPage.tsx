import { useI18n } from '@/i18n/useI18n';

/**
 * Any address under /cacador/ that names no screen (a typo, a stale link): a
 * heading and one line, under the layout's back control to Home, rather than a
 * blank page.
 */
export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t.common.notFound.title}</h1>
      <p className="text-muted-foreground">{t.common.notFound.body}</p>
    </section>
  );
}
