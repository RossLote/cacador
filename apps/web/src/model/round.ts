/**
 * A round of practice (DESIGN.md § 6.4): a practice session with an end, so
 * many questions and then the score. Endless practice is the same draw with
 * no round.
 */

/** How many questions Home's round card asks for. */
export const ROUND_SIZE = 10;

/** The address of a round of `size` questions over the whole bank. */
export function roundPath(size: number = ROUND_SIZE): string {
  return `/practice?round=${size}`;
}

/**
 * The round's size from the query's `round`: a whole number of at least 1.
 * Anything else, or no value, is endless practice.
 */
export function parseRoundSize(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const size = Number(value);
  return size >= 1 && Number.isSafeInteger(size) ? size : undefined;
}
