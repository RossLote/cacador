import { useI18n } from '@/i18n/useI18n';

/** Placeholder for the Settings screen, replaced by its screen bead. */
export function SettingsPage() {
  const { t } = useI18n();
  return <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>;
}
