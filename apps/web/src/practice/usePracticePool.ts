import { bankPool } from '@/model';

/**
 * The ids practice draws from, computed in this one place. Today it is the
 * whole bank; focused practice (cac-eil.14) narrows it from the query
 * (?topic=, ?section=, ?pattern=, D4) and returns the group for the chip.
 * The returned array must keep its identity while the query is unchanged:
 * a new pool starts a new draw.
 */
export function usePracticePool(): readonly number[] {
  return bankPool;
}
