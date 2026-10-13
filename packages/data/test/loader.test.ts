import { describe, expect, it } from 'vitest';
import {
  chunkFiles,
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
  it('imports exactly the manifest chunk files, in order', () => {
    expect(chunkFiles).toEqual(manifest.chunks.map((c) => c.file));
  });

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

  it('every question resolves to a section and a topic', () => {
    for (const q of questions) {
      expect(sectionOf(q), `section of ${q.id}`).toBeDefined();
      expect(topicOf(q), `topic of ${q.id}`).toBeDefined();
    }
  });

  it('has no English translation or hint yet', () => {
    for (const id of [1, 229, 506]) {
      expect(translationFor(id)).toBeUndefined();
      expect(hintFor(id)).toBeUndefined();
    }
  });
});
