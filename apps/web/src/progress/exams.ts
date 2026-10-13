import { isFinished, type FinishedExam } from '@/model';
import type { Exam } from '@/storage';

/**
 * Past exams as Progress lists them (DESIGN.md § 6.6): finished ones only,
 * newest finished first, so the order follows the date each row shows. This is
 * the one definition of the order; storage's listExams sorts by start, and the
 * two differ when exams overlap (possible after an import merges two devices).
 */
export function pastExams(exams: readonly Exam[]): FinishedExam[] {
  return exams.filter(isFinished).sort((a, b) => b.finishedAt - a.finishedAt);
}
