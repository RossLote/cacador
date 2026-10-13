import { hintFor, patterns, sections, topics } from '@cacador/data';
import { describe, expect, it } from 'vitest';
import { bankPool, patternPool, sectionPool, topicPool } from './pools';

describe('pools', () => {
  it('the bank pool holds all 506 ids', () => {
    expect(bankPool).toHaveLength(506);
    expect(new Set(bankPool).size).toBe(506);
  });

  it('topic and section pools tile the bank', () => {
    expect(topics.flatMap((t) => topicPool(t.slug)).sort((a, b) => a - b)).toEqual([...bankPool]);
    expect(sections.flatMap((s) => sectionPool(s.slug)).sort((a, b) => a - b)).toEqual([...bankPool]);
    expect(topicPool('patos')).toHaveLength(28);
    expect(topicPool('nope')).toEqual([]);
  });

  it('a pattern pool holds exactly the questions whose hint carries the tag', () => {
    const tagged = bankPool.filter((id) => hintFor(id)?.patterns.includes('only'));
    const pool = patternPool('only');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).toHaveLength(tagged.length);
    for (const id of pool) expect(hintFor(id)?.patterns).toContain('only');
    for (const p of patterns) expect(patternPool(p.slug).length).toBeGreaterThan(0);
    expect(patternPool('nope')).toEqual([]);
  });
});
