import { questionById, type OptionKey } from '@cacador/data';
import type { Exam } from '@/storage/types';
import type { RandomSource } from './random';
import { bankPool } from './pools';

/** Questions in a mock exam (D3). */
export const EXAM_SIZE = 20;

/** The exam's time limit, ms (D3). */
export const EXAM_DURATION_MS = 30 * 60 * 1000;

/** Right answers out of 20 needed to pass (D3). */
export const EXAM_PASS_MARK = 15;

/** 20 distinct question ids drawn uniformly from the bank (D3), by a partial Fisher-Yates shuffle. */
export function drawExam(random: RandomSource = Math.random): number[] {
  const ids = [...bankPool];
  const size = Math.min(EXAM_SIZE, ids.length);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (ids.length - i));
    const picked = ids[j] as number;
    ids[j] = ids[i] as number;
    ids[i] = picked;
  }
  return ids.slice(0, size);
}

/** When the exam ends: its start plus 30 minutes, ms since the epoch (D3). */
export function examDeadline(exam: Pick<Exam, 'startedAt'>): number {
  return exam.startedAt + EXAM_DURATION_MS;
}

/** The time left at `now`, ms, clamped at zero once past the deadline. */
export function examTimeLeft(exam: Pick<Exam, 'startedAt'>, now: number): number {
  return Math.max(0, examDeadline(exam) - now);
}

export interface ExamQuestionResult {
  questionId: number;
  /** The option chosen; absent when left unanswered. */
  chosen?: OptionKey;
  /** False for an unanswered question (D3). */
  correct: boolean;
}

/** Each exam question in order with what was chosen and whether it was right; an unanswered one is wrong (D3). */
export function examResults(exam: Pick<Exam, 'questionIds' | 'answers'>): ExamQuestionResult[] {
  return exam.questionIds.map((questionId) => {
    const chosen = exam.answers[questionId];
    const correct = chosen !== undefined && questionById(questionId)?.answer === chosen;
    return chosen === undefined ? { questionId, correct } : { questionId, chosen, correct };
  });
}

/** The exam's score: right answers out of 20, an unanswered question counting wrong (D3). */
export function scoreExam(exam: Pick<Exam, 'questionIds' | 'answers'>): number {
  return examResults(exam).filter((r) => r.correct).length;
}

/** Whether a score passes: 15 or more of 20 (D3). */
export function examPassed(score: number): boolean {
  return score >= EXAM_PASS_MARK;
}
