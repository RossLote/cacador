import type { OptionKey } from '@cacador/data';
import { describe, expect, it } from 'vitest';
import type { Exam } from '@/storage/types';
import {
  drawExam,
  EXAM_DURATION_MS,
  examDeadline,
  examPassed,
  examResults,
  examTimeLeft,
  isCorrectOption,
  scoreExam,
} from './exam';
import { seededRandom } from './random';
import { correctOf, wrongOf } from '../../test/fixtures';

/** An exam over the first 20 ids with `right` right, `unanswered` left blank and the rest wrong. */
function exam(right: number, unanswered: number): Exam {
  const questionIds = Array.from({ length: 20 }, (_, i) => i + 1);
  const answers: Record<number, OptionKey> = {};
  questionIds.forEach((id, i) => {
    if (i < right) answers[id] = correctOf(id);
    else if (i >= right + unanswered) answers[id] = wrongOf(id);
  });
  return { id: 'e1', startedAt: 0, questionIds, answers };
}

describe('drawExam', () => {
  it('draws 20 distinct ids between 1 and 506, and two random sources differ', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const ids = drawExam(seededRandom(seed));
      expect(ids).toHaveLength(20);
      expect(new Set(ids).size).toBe(20);
      for (const id of ids) {
        expect(id).toBeGreaterThanOrEqual(1);
        expect(id).toBeLessThanOrEqual(506);
      }
    }
    expect(drawExam(seededRandom(1))).not.toEqual(drawExam(seededRandom(2)));
    expect(drawExam(seededRandom(1))).toEqual(drawExam(seededRandom(1)));
  });
});

describe('exam clock', () => {
  it('ends 30 minutes after the start and never shows negative time', () => {
    const e = { startedAt: 1_000_000 };
    expect(examDeadline(e)).toBe(1_000_000 + 30 * 60 * 1000);
    expect(examTimeLeft(e, 1_000_000)).toBe(EXAM_DURATION_MS);
    expect(examTimeLeft(e, 1_000_000 + 60_000)).toBe(EXAM_DURATION_MS - 60_000);
    expect(examTimeLeft(e, examDeadline(e))).toBe(0);
    expect(examTimeLeft(e, examDeadline(e) + 5_000)).toBe(0);
  });
});

describe('exam score', () => {
  it('counts an unanswered question wrong: 14 right and one unanswered scores 14 and fails', () => {
    const e = exam(14, 1);
    expect(scoreExam(e)).toBe(14);
    expect(examPassed(scoreExam(e))).toBe(false);
    const blank = examResults(e)[14];
    expect(blank).toEqual({ questionId: 15, correct: false });
  });

  it('passes at 15 right', () => {
    expect(scoreExam(exam(15, 0))).toBe(15);
    expect(examPassed(scoreExam(exam(15, 0)))).toBe(true);
    expect(examPassed(20)).toBe(true);
  });
});

describe('isCorrectOption', () => {
  it('is right only for the bank answer, and no option chosen is wrong', () => {
    expect(isCorrectOption(4, correctOf(4))).toBe(true);
    expect(isCorrectOption(4, wrongOf(4))).toBe(false);
    expect(isCorrectOption(4, undefined)).toBe(false);
    expect(isCorrectOption(507, 'A')).toBe(false);
  });
});
