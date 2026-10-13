import { useI18n } from '@/i18n/useI18n';

/** Placeholder for the Exam screen, replaced by its screen bead. It is routed as /exam/* so this folder owns its sub-routes (start, running, results/<id>). */
export function ExamPage() {
  const { t } = useI18n();
  return <h1 className="text-2xl font-semibold tracking-tight">{t.exam.title}</h1>;
}
