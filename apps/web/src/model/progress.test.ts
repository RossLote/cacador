import { questionsInTopic } from '@cacador/data';
import { describe, expect, it } from 'vitest';
import type { Answer, QuestionState } from '@/storage/types';
import { localDateKey } from './dates';
import { topicPool } from './pools';
import { accuracyByDay, groupAccuracy, readiness } from './progress';
import { indexStates, recentShare } from './states';

function seen(questionId: number, recent: boolean[]): QuestionState {
  let streak = 0;
  for (const right of recent) streak = right ? streak + 1 : 0;
  return {
    questionId,
    attempts: recent.length,
    correct: recent.filter(Boolean).length,
    streak,
    recent,
    lastSeenAt: 0,
  };
}

describe('recentShare', () => {
  it('is the share right in the last three, undefined when unseen', () => {
    expect(recentShare(undefined)).toBeUndefined();
    expect(recentShare(seen(1, [true, false, true]))).toBeCloseTo(2 / 3, 12);
    expect(recentShare(seen(1, [false]))).toBe(0);
  });
});

describe('readiness', () => {
  it('is 33 % with 506 unseen on a fresh device', () => {
    const r = readiness(new Map());
    expect(r.percent).toBe(33);
    expect(r.unseen).toBe(506);
    expect(r.total).toBe(506);
    expect(r.fraction).toBeCloseTo(1 / 3, 12);
  });

  it('rises by exactly (1 − 1/3) / 506 after one right answer on one question', () => {
    const before = readiness(new Map()).fraction;
    const after = readiness(indexStates([seen(42, [true])]));
    expect(after.unseen).toBe(505);
    expect(after.fraction - before).toBeCloseTo((1 - 1 / 3) / 506, 14);
  });
});

describe('groupAccuracy', () => {
  it('reports the topic patos as not started with 0 of 28 seen', () => {
    const g = groupAccuracy(topicPool('patos'), new Map());
    expect(g).toEqual({ accuracy: undefined, percent: undefined, seen: 0, total: 28 });
  });

  it('is the mean recent share over the seen questions only', () => {
    const [a, b] = questionsInTopic('patos');
    if (!a || !b) throw new Error('patos has questions');
    const g = groupAccuracy(topicPool('patos'), indexStates([seen(a.id, [true, true, false]), seen(b.id, [true])]));
    expect(g.seen).toBe(2);
    expect(g.total).toBe(28);
    expect(g.accuracy).toBeCloseTo((2 / 3 + 1) / 2, 12);
    expect(g.percent).toBe(83);
  });
});

describe('accuracyByDay', () => {
  const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).getTime();
  const answer = (time: number, correct: boolean): Answer => ({ questionId: 1, at: time, correct, mode: 'practice', chosen: 'A' });

  it('counts right and total per local calendar day for the last 30 days, today last', () => {
    const now = at(2026, 10, 13, 15);
    const days = accuracyByDay(
      [
        answer(at(2026, 10, 10, 0), true),
        answer(at(2026, 10, 10, 12), false),
        answer(at(2026, 10, 10, 23), true),
        answer(at(2026, 9, 13, 12), true), // 30 days back: outside the window
        answer(at(2026, 10, 13, 9), false),
      ],
      now,
    );
    expect(days).toHaveLength(30);
    expect(days.at(-1)?.date).toBe('2026-10-13');
    expect(days[0]?.date).toBe('2026-09-14');
    const byDate = new Map(days.map((d) => [d.date, d]));
    expect(byDate.get('2026-10-10')).toMatchObject({ correct: 2, total: 3 });
    expect(byDate.get('2026-10-11')).toMatchObject({ correct: 0, total: 0 });
    expect(byDate.get('2026-10-13')).toMatchObject({ correct: 0, total: 1 });
    expect(byDate.get('2026-10-10')?.start).toBe(at(2026, 10, 10, 0));
    expect(days.reduce((sum, d) => sum + d.total, 0)).toBe(4);
  });

  it('formats a local date key', () => {
    expect(localDateKey(at(2026, 3, 5, 23))).toBe('2026-03-05');
  });
});
