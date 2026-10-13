import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  hintFor,
  manifest,
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

  // The loader lists translation and hint files by hand (src/index.ts); this catches a file
  // that exists on disk, and so passes the validator, but was never wired in.
  describe('English files', () => {
    const jsonIn = (dir: string): { id: number }[][] => {
      const path = new URL(`../${dir}/`, import.meta.url);
      if (!existsSync(path)) return [];
      return readdirSync(path)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(readFileSync(new URL(name, path), 'utf8')) as { id: number }[]);
    };
    const translationFiles = jsonIn('translations/en');
    const hintFiles = jsonIn('hints/en');

    it('wires every translation file on disk into translationFor', () => {
      if (translationFiles.length === 0) {
        for (const id of [1, 229, 506]) expect(translationFor(id)).toBeUndefined();
      }
      for (const entry of translationFiles.flat()) expect(translationFor(entry.id)).toBeDefined();
    });

    it('wires every hint file on disk into hintFor', () => {
      if (hintFiles.length === 0) {
        for (const id of [1, 229, 506]) expect(hintFor(id)).toBeUndefined();
      }
      for (const entry of hintFiles.flat()) expect(hintFor(entry.id)).toBeDefined();
    });
  });
});
