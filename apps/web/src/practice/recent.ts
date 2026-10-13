/**
 * The practice draw over the app-wide no-repeat window (D4, D5). The window
 * itself, in sessionStorage or in memory when that is blocked, belongs to the
 * storage module, which Clear progress empties (D8, D16).
 */
import { addToRecent, drawQuestion, type StateMap } from '@/model';
import { readRecentWindow, writeRecentWindow } from '@/storage';

/**
 * Draws the next practice question from `pool` by the model's weights, outside
 * the recent window, and adds it to the window. Undefined only for an empty pool.
 */
export function drawPracticeQuestion(pool: readonly number[], states: StateMap): number | undefined {
  const recent = readRecentWindow();
  const id = drawQuestion(pool, states, recent);
  if (id !== undefined) writeRecentWindow(addToRecent(recent, id));
  return id;
}
