import { describe, expect, it } from 'vitest';
import type { QuestionState } from '@/storage/types';
import { addToRecent, drawQuestion, drawWeight, noRepeatWindow, RECENT_LIMIT } from './draw';
import { seededRandom } from './random';

/** A state after `attempts` answers ending in a streak of `streak` right. */
function state(questionId: number, attempts: number, streak: number): QuestionState {
  const length = Math.min(3, attempts);
  const recent = Array.from({ length }, (_, i) => length - i <= streak);
  return { questionId, attempts, correct: streak, streak, recent, lastSeenAt: 0 };
}

/** States giving the ids weights 4, 2 and 0.5 in turn. */
function weighted(ids: [number, number, number]): Map<number, QuestionState> {
  return new Map([
    [ids[0], state(ids[0], 2, 0)],
    [ids[1], state(ids[1], 1, 1)],
    [ids[2], state(ids[2], 3, 3)],
  ]);
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

describe('drawWeight', () => {
  it('gives each state the weight D5 states', () => {
    expect(drawWeight(undefined)).toBe(3);
    expect(drawWeight({ ...state(1, 0, 0), recent: [] })).toBe(3);
    expect(drawWeight(state(1, 1, 0))).toBe(4);
    expect(drawWeight(state(1, 5, 0))).toBe(4);
    expect(drawWeight(state(1, 1, 1))).toBe(2);
    expect(drawWeight(state(1, 4, 2))).toBe(1);
    expect(drawWeight(state(1, 3, 3))).toBe(0.5);
    expect(drawWeight(state(1, 9, 7))).toBe(0.5);
  });
});

describe('noRepeatWindow', () => {
  it('is the smaller of ten and half the pool rounded down', () => {
    expect(noRepeatWindow(506)).toBe(10);
    expect(noRepeatWindow(20)).toBe(10);
    expect(noRepeatWindow(11)).toBe(5);
    expect(noRepeatWindow(3)).toBe(1);
    expect(noRepeatWindow(2)).toBe(1);
    expect(noRepeatWindow(1)).toBe(0);
  });
});

describe('drawQuestion', () => {
  it('draws by weight: 4, 2 and 0.5 land near 62 %, 31 % and 8 %', () => {
    const states = weighted([1, 2, 3]);
    const random = seededRandom(42);
    const counts = new Map<number, number>();
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const id = drawQuestion([1, 2, 3], states, [], random);
      expect(id).toBeDefined();
      if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(Math.abs((counts.get(1) ?? 0) / n - 0.62)).toBeLessThan(0.03);
    expect(Math.abs((counts.get(2) ?? 0) / n - 0.31)).toBeLessThan(0.03);
    expect(Math.abs((counts.get(3) ?? 0) / n - 0.08)).toBeLessThan(0.03);
  });

  it('never returns one of the last ten drawn ids for a pool of twenty or more', () => {
    for (const pool of [range(1, 20), range(1, 506)]) {
      const recent = [3, 5, 7, 9, 11, 12, 14, 16, 18, 20];
      const random = seededRandom(7);
      for (let i = 0; i < 2000; i++) {
        const id = drawQuestion(pool, new Map(), recent, random);
        expect(id).toBeDefined();
        expect(recent).not.toContain(id);
      }
    }
  });

  it('excludes exactly the last five for a pool of eleven', () => {
    const pool = range(100, 11);
    const recent = [100, 101, 102, 103, 104, 105, 106];
    const random = seededRandom(3);
    const drawn = new Set<number>();
    for (let i = 0; i < 2000; i++) drawn.add(drawQuestion(pool, new Map(), recent, random) ?? -1);
    expect([...drawn].sort((a, b) => a - b)).toEqual([100, 101, 107, 108, 109, 110]);
  });

  it('never repeats the last drawn id for a pool of two or three, and still draws from a pool of one', () => {
    const random = seededRandom(11);
    for (let i = 0; i < 500; i++) {
      expect(drawQuestion([1, 2], new Map(), [2], random)).toBe(1);
      expect(drawQuestion([1, 2, 3], new Map(), [1, 3], random)).not.toBe(3);
    }
    expect(drawQuestion([9], new Map(), [9], random)).toBe(9);
    expect(drawQuestion([], new Map(), [], random)).toBeUndefined();
  });

  it('counts the window over ids in the pool, so draws from the whole bank in between do not reopen it', () => {
    const random = seededRandom(5);
    const recent = [2, 400, 401, 402, 403];
    for (let i = 0; i < 500; i++) expect(drawQuestion([1, 2, 3], new Map(), recent, random)).not.toBe(2);
  });

  it('in a pool of three with the window applied, draws the two eligible questions by weight, not in turn', () => {
    const pool = [1, 2, 3];
    const states = weighted([1, 2, 3]);
    const random = seededRandom(99);
    let recent: number[] = [];
    // After each id, how often each other id came next.
    const next = new Map<number, Map<number, number>>(pool.map((id) => [id, new Map()]));
    let last: number | undefined;
    for (let i = 0; i < 20_000; i++) {
      const id = drawQuestion(pool, states, recent, random);
      if (id === undefined) throw new Error('empty draw');
      if (last !== undefined) {
        expect(id).not.toBe(last);
        const row = next.get(last);
        row?.set(id, (row.get(id) ?? 0) + 1);
      }
      recent = addToRecent(recent, id);
      last = id;
    }
    // After 3 (weight 0.5), 1 and 2 follow at 4 : 2; after 1, 2 and 3 at 2 : 0.5; after 2, 1 and 3 at 4 : 0.5.
    const share = (from: number, to: number) => {
      const row = next.get(from) ?? new Map<number, number>();
      const total = [...row.values()].reduce((a, b) => a + b, 0);
      return (row.get(to) ?? 0) / total;
    };
    expect(Math.abs(share(3, 1) - 4 / 6)).toBeLessThan(0.03);
    expect(Math.abs(share(1, 2) - 2 / 2.5)).toBeLessThan(0.03);
    expect(Math.abs(share(2, 1) - 4 / 4.5)).toBeLessThan(0.03);
    // Not a fixed rotation: every eligible follower occurs.
    for (const from of pool) expect(next.get(from)?.size).toBe(2);
  });
});

describe('addToRecent', () => {
  it('appends newest last, moves a repeated id to the end and keeps the ten newest', () => {
    expect(addToRecent([], 4)).toEqual([4]);
    expect(addToRecent([1, 2, 3], 2)).toEqual([1, 3, 2]);
    const full = range(1, RECENT_LIMIT);
    expect(addToRecent(full, 99)).toEqual([...range(2, 9), 99]);
    expect(addToRecent(full, 99)).toHaveLength(10);
  });
});
