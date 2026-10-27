/**
 * The app-wide no-repeat window (D4, D5): the most recently drawn question ids,
 * oldest first, as a JSON array in sessionStorage under RECENT_KEY, so it
 * survives moving between screens and a reload in the same tab. Garbled
 * storage reads as an empty window. When sessionStorage cannot hold the window
 * (blocked site data), it is kept in memory for the page's life instead, and
 * Clear progress forgets that copy too (D8).
 */
import { RECENT_KEY } from './keys';
import { webStorageSlot } from './webStorageSlot';

const slot = webStorageSlot('sessionStorage', RECENT_KEY, (stored) =>
  Array.isArray(stored) ? stored.filter((id): id is number => Number.isInteger(id)) : undefined,
);

/** The no-repeat window, oldest first; empty when nothing was drawn or the stored copy is garbled. */
export function readRecentWindow(): number[] {
  return slot.read() ?? [];
}

/** Replaces the no-repeat window, in sessionStorage when it can hold it and in memory otherwise. */
export function writeRecentWindow(ids: number[]): void {
  slot.write(ids);
}

/** Forgets the no-repeat window, stored or in memory (Clear progress, D8). */
export function clearRecentWindow(): void {
  slot.clear();
}
