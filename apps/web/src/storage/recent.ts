/**
 * The app-wide no-repeat window (D4, D5): the most recently drawn question ids,
 * oldest first, as a JSON array in sessionStorage under RECENT_KEY, so it
 * survives moving between screens and a reload in the same tab. Garbled
 * storage reads as an empty window. When sessionStorage cannot hold the window
 * (blocked site data), it is kept in memory for the page's life instead, and
 * Clear progress forgets that copy too (D8).
 */
import { RECENT_KEY } from './keys';

/** The window as last written while sessionStorage could not hold it; undefined while storage holds it. */
let unstored: number[] | undefined;

/** The no-repeat window, oldest first; empty when nothing was drawn or the stored copy is garbled. */
export function readRecentWindow(): number[] {
  if (unstored !== undefined) return unstored;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

/** Replaces the no-repeat window, in sessionStorage when it can hold it and in memory otherwise. */
export function writeRecentWindow(ids: number[]): void {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    unstored = undefined;
  } catch {
    unstored = ids;
  }
}

/** Forgets the no-repeat window, stored or in memory (Clear progress, D8). */
export function clearRecentWindow(): void {
  unstored = undefined;
  try {
    globalThis.sessionStorage?.removeItem(RECENT_KEY);
  } catch {
    // Web Storage blocked: the memory copy above was the only window.
  }
}
