import { useI18n } from '@/i18n/useI18n';

/** Placeholder for the Flagged screen, replaced by its screen bead. */
export function FlaggedPage() {
  const { t } = useI18n();
  return <h1 className="text-2xl font-semibold tracking-tight">{t.flagged.title}</h1>;
}
