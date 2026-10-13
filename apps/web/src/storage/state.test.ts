import { describe, expect, it } from 'vitest';
import { EXAM_DURATION_MS } from '@/model';
import { finishExamRecords, isRunning } from './finish';
import { applyAnswer, deriveState, isInOrder, nextState } from './state';
import type { Answer, Exam } from './types';
import { correctOf } from '../../test/fixtures';

const answer = (correct: boolean, at: number, id?: number): Answer => ({ questionId: 7, at, correct, mode: 'practice', id });

describe('applyAnswer', () => {
  it('starts a state from the first answer', () => {
    expect(applyAnswer(undefined, answer(true, 100))).toEqual({
      questionId: 7,
      attempts: 1,
      correct: 1,
      streak: 1,
      recent: [true],
      lastSeenAt: 100,
    });
  });

  it('three right then one wrong: streak 0, recent the last three newest last', () => {
    const state = [answer(true, 1), answer(true, 2), answer(true, 3), answer(false, 4)].reduce(applyAnswer, undefined);
    expect(state).toEqual({ questionId: 7, attempts: 4, correct: 3, streak: 0, recent: [true, true, false], lastSeenAt: 4 });
  });

  it('counts the streak up after a wrong answer', () => {
    const state = [answer(false, 1), answer(true, 2), answer(true, 3)].reduce(applyAnswer, undefined);
    expect(state?.streak).toBe(2);
    expect(state?.recent).toEqual([false, true, true]);
  });
});

describe('deriveState and nextState', () => {
  it('folds the log in time order, then insertion order', () => {
    const log = [answer(false, 5, 3), answer(true, 1, 1), answer(true, 5, 2)];
    expect(deriveState(log)).toMatchObject({ attempts: 3, correct: 2, streak: 0, recent: [true, true, false], lastSeenAt: 5 });
    expect(deriveState([])).toBeUndefined();
  });

  it('applies an answer on top when in order and rebuilds from the log when older', () => {
    const before = deriveState([answer(true, 1, 1), answer(false, 10, 2)]);
    const late = answer(true, 20, 3);
    expect(isInOrder(before, late)).toBe(true);
    expect(nextState(before, late, () => [])).toMatchObject({ streak: 1, recent: [true, false, true], lastSeenAt: 20 });

    const early = answer(true, 5, 3);
    expect(isInOrder(before, early)).toBe(false);
    const log = [answer(true, 1, 1), answer(false, 10, 2), early];
    expect(nextState(before, early, () => log)).toMatchObject({ attempts: 3, streak: 0, recent: [true, true, false], lastSeenAt: 10 });
  });
});

describe('finishExamRecords', () => {
  const questionIds = Array.from({ length: 20 }, (_, i) => i + 1);
  const exam: Exam = { id: 'e1', startedAt: 1000, questionIds, answers: { 1: correctOf(1), 2: correctOf(2) } };

  it('scores the exam and logs one answer per question, unanswered ones wrong with no chosen option', () => {
    const { exam: finished, answers } = finishExamRecords(exam, 2000);
    expect(finished).toMatchObject({ id: 'e1', finishedAt: 2000, score: 2 });
    expect(answers).toHaveLength(20);
    expect(answers[0]).toEqual({ questionId: 1, at: 2000, chosen: correctOf(1), correct: true, mode: 'exam', examId: 'e1' });
    expect(answers[5]).toEqual({ questionId: 6, at: 2000, correct: false, mode: 'exam', examId: 'e1' });
    expect('chosen' in (answers[5] ?? {})).toBe(false);
  });

  it('holds the finish to the deadline', () => {
    const deadline = 1000 + EXAM_DURATION_MS;
    const { exam: finished, answers } = finishExamRecords(exam, deadline + 5000);
    expect(finished.finishedAt).toBe(deadline);
    expect(answers.every((a) => a.at === deadline)).toBe(true);
  });

  it('runs until the deadline and not after finishing', () => {
    expect(isRunning(exam, 1000 + EXAM_DURATION_MS - 1)).toBe(true);
    expect(isRunning(exam, 1000 + EXAM_DURATION_MS)).toBe(false);
    expect(isRunning({ ...exam, finishedAt: 1500 }, 1600)).toBe(false);
  });
});
