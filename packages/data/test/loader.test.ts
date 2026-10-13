import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  hintFor,
  manifest,
  patterns,
  questionById,
  questions,
  questionsInSection,
  questionsInTopic,
  sectionOf,
  sections,
  topicOf,
  topics,
  translationFor,
} from '../src/index';

describe('loader', () => {
  it('holds all 506 questions in id order', () => {
    expect(questions).toHaveLength(506);
    expect(questions.map((q) => q.id)).toEqual(Array.from({ length: 506 }, (_, i) => i + 1));
  });

  it('looks questions up by id', () => {
    const q = questionById(229);
    expect(q?.image).toBe('q229.jpg');
    expect(q?.answer).toBe('C');
    expect(q?.options.C).toBe('Pato-real');
    expect(questionById(0)).toBeUndefined();
    expect(questionById(507)).toBeUndefined();
  });

  it('groups by section and topic', () => {
    expect(questionsInSection('biologia')).toHaveLength(262);
    expect(questionsInTopic('patos')).toHaveLength(28);
    expect(questionsInSection('nope')).toEqual([]);
  });

  it('exposes sections, topics and their owners', () => {
    expect(sections).toBe(manifest.sections);
    expect(topics).toBe(manifest.topics);
    const q = questionById(229);
    if (!q) throw new Error('question 229 missing');
    expect(sectionOf(q)?.slug).toBe('biologia');
    expect(topicOf(q)?.slug).toBe('patos');
  });

  // The loader lists translation and hint files by hand (src/index.ts). The validator makes every
  // file under translations/en and hints/en carry exactly its chunk's ids, so a chunk file that
  // exists on disk must resolve every id of the chunk to the entry of that id, or it was never wired in.
  it.each([
    ['translations/en', translationFor],
    ['hints/en', hintFor],
  ] as const)('wires every file in %s into the loader', (dir, lookup) => {
    const onDisk = manifest.chunks.filter((c) => existsSync(new URL(`../${dir}/${c.file}`, import.meta.url)));
    const missing = onDisk.flatMap((c) => Array.from({ length: c.to - c.from + 1 }, (_, i) => c.from + i)).filter((id) => lookup(id)?.id !== id);
    expect(missing).toEqual([]);
    if (onDisk.length === 0) for (const id of [1, 229, 506]) expect(lookup(id)).toBeUndefined();
  });

  it('exports a pattern for every tag a loaded hint carries', () => {
    const slugs = new Set(patterns.map((p) => p.slug));
    expect(slugs.size).toBe(patterns.length);
    const unknown = questions.flatMap((q) => hintFor(q.id)?.patterns ?? []).filter((tag) => !slugs.has(tag));
    expect(unknown).toEqual([]);
    expect(slugs.size).toBeGreaterThan(0);
  });

  it.each([
    ['translations', translationFor],
    ['hints', hintFor],
  ] as const)('resolves %s that have passed the meaning pass or the check', (_, lookup) => {
    for (const id of [1, 229, 506]) expect(['checked', 'reviewed']).toContain(lookup(id)?.status);
  });
});
