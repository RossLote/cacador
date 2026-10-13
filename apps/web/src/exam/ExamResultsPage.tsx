import { useI18n } from '@/i18n/useI18n';

/** Placeholder for /exam/results/<id>, where Submit lands; cac-eil.16 replaces it with the results and review. */
export function ExamResultsPage() {
  const { t } = useI18n();
  return <h1 className="text-xl font-semibold tracking-tight">{t.exam.title}</h1>;
}
