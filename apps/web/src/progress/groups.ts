import { nameIn } from '@/components/question/names';
import type { Locale } from '@/i18n/locales';
import {
  groupAccuracy,
  groupPath,
  GROUPS,
  READINESS_TARGET_PERCENT,
  type GroupAccuracy,
  type GroupKind,
  type StateMap,
} from '@/model';

export interface GroupRow {
  slug: string;
  name: string;
  /** Focused practice on this group: /practice?<kind>=<slug>. */
  to: string;
  accuracy: GroupAccuracy;
}

/**
 * Worst first: started rows by accuracy, lowest first, then the not-started
 * rows. Array.prototype.sort is stable, so ties keep the manifest order.
 */
function worstFirst(a: GroupRow, b: GroupRow): number {
  const x = a.accuracy.accuracy;
  const y = b.accuracy.accuracy;
  if (x === undefined || y === undefined) return (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0);
  return x - y;
}

/** One list's rows in the interface language, sorted worst first with the not-started rows last (D11). */
export function groupRows(kind: GroupKind, states: StateMap, locale: Locale): GroupRow[] {
  return GROUPS[kind]
    .map((group) => ({
      slug: group.slug,
      name: nameIn(group, locale),
      to: groupPath(kind, group.slug),
      accuracy: groupAccuracy(group.pool, states),
    }))
    .sort(worstFirst);
}

/** A started group's colour (epic cac-8cn D7, D10): rust under the 75 % line, forest at it or above. */
export function percentTone(percent: number): 'rust' | 'forest' {
  return percent < READINESS_TARGET_PERCENT ? 'rust' : 'forest';
}
