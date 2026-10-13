import type { QuestionState } from '@/storage/types';
import type { RandomSource } from './random';
import { isSeen, type StateMap } from './states';

/**
 * The draw weight of a question from its state at draw time, never stored (D5):
 * unseen 3; wrong last time (attempts above 0, streak 0) 4; streak 1 → 2;
 * streak 2 → 1; streak 3 or more → 0.5.
 */
export function drawWeight(state: QuestionState | undefined): number {
  if (!isSeen(state)) return 3;
  if (state.streak <= 0) return 4;
  if (state.streak === 1) return 2;
  if (state.streak === 2) return 1;
  return 0.5;
}

/** The longest no-repeat window, and so how many ids the recent list keeps (D5). */
export const RECENT_LIMIT = 10;

/**
 * How many of the most recently drawn ids a draw over a pool of this size
 * excludes: the smaller of ten and half the pool rounded down (D5).
 */
export function noRepeatWindow(poolSize: number): number {
  return Math.min(RECENT_LIMIT, Math.floor(poolSize / 2));
}

/**
 * The ids a draw over this pool leaves out: the last N distinct ids of the
 * recent list that are in the pool, N being the pool's window. Counting only
 * ids in the pool means a draw from the whole bank in between never lets a
 * small pool repeat its own last question.
 */
function excludedIds(pool: readonly number[], recent: readonly number[]): Set<number> {
  const inPool = new Set(pool);
  const window = noRepeatWindow(inPool.size);
  const excluded = new Set<number>();
  for (let i = recent.length - 1; i >= 0 && excluded.size < window; i--) {
    const id = recent[i];
    if (id !== undefined && inPool.has(id)) excluded.add(id);
  }
  return excluded;
}

/**
 * The next practice question: a draw by weight over the pool minus the
 * recently drawn ids (D4, D5). `recent` is the app-wide recent list, oldest
 * first; `random` is injectable for tests. Undefined only for an empty pool.
 */
export function drawQuestion(
  pool: readonly number[],
  states: StateMap,
  recent: readonly number[],
  random: RandomSource = Math.random,
): number | undefined {
  const excluded = excludedIds(pool, recent);
  const candidates = [...new Set(pool)].filter((id) => !excluded.has(id));
  const weights = candidates.map((id) => drawWeight(states.get(id)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let point = random() * total;
  for (const [i, id] of candidates.entries()) {
    point -= weights[i] ?? 0;
    if (point < 0) return id;
  }
  return candidates.at(-1);
}

/**
 * The recent list after drawing `id`: the id moved to the end (newest last),
 * trimmed to the RECENT_LIMIT newest ids, which is all the largest window needs.
 */
export function addToRecent(recent: readonly number[], id: number): number[] {
  return [...recent.filter((other) => other !== id), id].slice(-RECENT_LIMIT);
}
