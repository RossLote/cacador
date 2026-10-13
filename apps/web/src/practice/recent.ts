/**
 * The app-wide no-repeat window (D4, D5): the most recently drawn question ids,
 * oldest first, as a JSON array in sessionStorage under RECENT_KEY, so it
 * survives moving between screens and a reload in the same tab. Blocked or
 * garbled storage reads as an empty window and a failed write is dropped.
 */
import { addToRecent, drawQuestion, type StateMap } from '@/model';
import { RECENT_KEY } from '@/storage';

function readRecent(): number[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: readonly number[]): void {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the window holds for this page only.
  }
}

/**
 * Draws the next practice question from `pool` by the model's weights, outside
 * the recent window, and adds it to the window. Undefined only for an empty pool.
 */
export function drawPracticeQuestion(pool: readonly number[], states: StateMap): number | undefined {
  const recent = readRecent();
  const id = drawQuestion(pool, states, recent);
  if (id !== undefined) writeRecent(addToRecent(recent, id));
  return id;
}
