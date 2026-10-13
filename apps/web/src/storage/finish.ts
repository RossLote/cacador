import { examDeadline, examResults, scoreExam } from '@/model';
import type { Answer, Exam } from './types';

/** An exam as submitted and the answers its submission logs. */
export interface FinishedExam {
  exam: Exam;
  /** One per exam question, in order, all timed at the finish (D3). */
  answers: Answer[];
}

/**
 * The records submitting `exam` at `at` writes (D3): the exam with finishedAt
 * and score, and one answer per question (mode exam, its id, chosen when
 * answered, correct per the model, an unanswered question wrong with no chosen
 * option). An exam cannot end after its deadline, so `at` is held to it: the
 * 30:00 auto-submit firing late and the settling of a stale exam both land on
 * the deadline.
 */
export function finishExamRecords(exam: Exam, at: number): FinishedExam {
  const finishedAt = Math.min(at, examDeadline(exam));
  const answers = examResults(exam).map(
    ({ questionId, chosen, correct }): Answer => ({
      questionId,
      at: finishedAt,
      ...(chosen === undefined ? {} : { chosen }),
      correct,
      mode: 'exam',
      examId: exam.id,
    }),
  );
  return { exam: { ...exam, finishedAt, score: scoreExam(exam) }, answers };
}

/** Whether the exam is still running at `now`: unfinished and before its deadline. */
export function isRunning(exam: Exam, now: number): boolean {
  return exam.finishedAt === undefined && now < examDeadline(exam);
}
