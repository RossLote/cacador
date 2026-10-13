import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { bankPool, findGroup, GROUP_KINDS, type Group, type GroupKind } from '@/model';

export interface PracticePool {
  /** The ids practice draws from. */
  pool: readonly number[];
  /** The group the pool is narrowed to, for the chip; undefined for the whole bank. */
  group: Group | undefined;
}

const WHOLE_BANK: PracticePool = { pool: bankPool, group: undefined };

/**
 * The pool for one query. With several of the three parameters, the first in
 * GROUP_KINDS order wins: topic over section, section over pattern (D4). An
 * unknown slug, or an empty pool, is the whole bank with no chip.
 */
function focus(slugs: Readonly<Record<GroupKind, string | null>>): PracticePool {
  for (const kind of GROUP_KINDS) {
    const slug = slugs[kind];
    if (slug === null) continue;
    const group = findGroup(kind, slug);
    return group !== undefined && group.pool.length > 0 ? { pool: group.pool, group } : WHOLE_BANK;
  }
  return WHOLE_BANK;
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
  return useMemo(() => focus({ topic, section, pattern }), [topic, section, pattern]);
}
