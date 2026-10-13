import { patterns, sections, topics } from '@cacador/data';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { bankPool, patternPool, sectionPool, topicPool } from '@/model';

/** What the chip names: a manifest topic or section, or a pattern, with its names in both languages. */
export interface PracticeGroup {
  en: string;
  pt: string;
}

export interface PracticePool {
  /** The ids practice draws from. */
  pool: readonly number[];
  /** The group the pool is narrowed to, for the chip; undefined for the whole bank. */
  group: PracticeGroup | undefined;
}

const WHOLE_BANK: PracticePool = { pool: bankPool, group: undefined };

/** The pool for one query. With several of the three parameters, topic wins over section and section over pattern (D4). */
function focus(topic: string | null, section: string | null, pattern: string | null): PracticePool {
  let found: PracticePool | undefined;
  if (topic !== null) {
    found = narrowed(topicPool(topic), topics.find((entry) => entry.slug === topic));
  } else if (section !== null) {
    found = narrowed(sectionPool(section), sections.find((entry) => entry.slug === section));
  } else if (pattern !== null) {
    found = narrowed(patternPool(pattern), patterns.find((entry) => entry.slug === pattern));
  }
  return found ?? WHOLE_BANK;
}

/** An unknown slug, or any empty pool, is the whole bank with no chip. */
function narrowed(pool: readonly number[], group: PracticeGroup | undefined): PracticePool | undefined {
  return pool.length > 0 && group !== undefined ? { pool, group } : undefined;
}

/**
 * The ids practice draws from, computed in this one place: the whole bank, or
 * with ?topic=<slug>, ?section=<slug> or ?pattern=<slug> that group (D4).
 * The result keeps its identity while the three slugs are unchanged: a new
 * pool starts a new draw.
 */
export function usePracticePool(): PracticePool {
  const [params] = useSearchParams();
  const topic = params.get('topic');
  const section = params.get('section');
  const pattern = params.get('pattern');
  return useMemo(() => focus(topic, section, pattern), [topic, section, pattern]);
}
