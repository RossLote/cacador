import { patterns, sections, topics } from '@cacador/data';
import { nameIn } from '@/components/question/names';
import type { Locale } from '@/i18n/locales';
import { groupAccuracy, patternPool, sectionPool, topicPool, type GroupAccuracy, type StateMap } from '@/model';

/** The three lists on Progress, each named by the focused-practice query parameter its rows link with (D4). */
export const GROUP_KINDS = ['topic', 'section', 'pattern'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

interface Group {
  slug: string;
  names: { en: string; pt: string };
  pool: readonly number[];
}

const toGroup = (entry: { slug: string; en: string; pt: string }, pool: readonly number[]): Group => ({
  slug: entry.slug,
  names: { en: entry.en, pt: entry.pt },
  pool,
});

/** Every group in manifest (or pattern-list) order with its pool, worked out once: the bank never changes. */
const GROUPS: Record<GroupKind, readonly Group[]> = {
  topic: topics.map((entry) => toGroup(entry, topicPool(entry.slug))),
  section: sections.map((entry) => toGroup(entry, sectionPool(entry.slug))),
  pattern: patterns.map((entry) => toGroup(entry, patternPool(entry.slug))),
};

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
      name: nameIn(group.names, locale) ?? group.slug,
      to: `/practice?${kind}=${encodeURIComponent(group.slug)}`,
      accuracy: groupAccuracy(group.pool, states),
    }))
    .sort(worstFirst);
}
