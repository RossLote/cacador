import { patterns, sections, topics } from '@cacador/data';
import { patternPool, sectionPool, topicPool } from './pools';

/**
 * The groups focused practice narrows to (D4), each kind named by its query
 * parameter, /practice?<kind>=<slug>, and listed in precedence order: with
 * several parameters, topic wins over section and section over pattern.
 */
export const GROUP_KINDS = ['topic', 'section', 'pattern'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

/** A name in both interface languages, as the manifest and the pattern list give it. */
export interface BilingualName {
  en: string;
  pt: string;
}

/** A manifest topic or section, or a pattern, with its names and the ids of its questions. */
export interface Group extends BilingualName {
  kind: GroupKind;
  slug: string;
  pool: readonly number[];
}

const toGroups = (
  kind: GroupKind,
  entries: readonly (BilingualName & { slug: string })[],
  poolOf: (slug: string) => readonly number[],
): readonly Group[] => entries.map(({ slug, en, pt }) => ({ kind, slug, en, pt, pool: poolOf(slug) }));

/** Every group in manifest (or pattern-list) order with its pool, worked out once: the bank never changes. */
export const GROUPS: Readonly<Record<GroupKind, readonly Group[]>> = {
  topic: toGroups('topic', topics, topicPool),
  section: toGroups('section', sections, sectionPool),
  pattern: toGroups('pattern', patterns, patternPool),
};

/** The group of this kind with this slug, or undefined for an unknown slug. */
export function findGroup(kind: GroupKind, slug: string): Group | undefined {
  return GROUPS[kind].find((group) => group.slug === slug);
}

/** Focused practice on a group: /practice?<kind>=<slug> (D4). */
export function groupPath(kind: GroupKind, slug: string): string {
  return `/practice?${kind}=${encodeURIComponent(slug)}`;
}
