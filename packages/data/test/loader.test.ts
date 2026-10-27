import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  findPhrase,
  hintFor,
  manifest,
  patterns,
  questionById,
  questionForWord,
  questions,
  questionsInSection,
  questionsInTopic,
  sectionOf,
  sections,
  topicOf,
  topics,
  translationFor,
  wordKinds,
  wordSite,
  words,
  type Word,
} from '../src/index';

const readData = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));

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

  // The loader lists the words/ files by hand too (src/index.ts); the validator makes words/ hold
  // exactly the twelve kind files and every word's kind its file's, so the list must be the files'
  // words kind by kind, or a file was never wired in or sits under another kind.
  it('wires every words/ file into the loader under its kind', () => {
    expect(readdirSync(new URL('../words', import.meta.url)).sort()).toEqual(wordKinds.map((kind) => `${kind}.json`));
    expect(words).toEqual(wordKinds.flatMap((kind) => readData(`words/${kind}.json`) as Word[]));
  });

  it('holds the 17 precedent words, with the two fixes of DESIGN.md § 5 step 5', () => {
    const sample = readData('source/words-sample.json') as Word[];
    expect(sample).toHaveLength(17);
    const byPt = new Map(words.map((w) => [w.pt, w]));
    for (const { pt, kind } of sample) expect(byPt.get(pt)?.kind).toBe(kind);
    expect(byPt.get('cio')).toMatchObject({ en: 'rut', note: expect.stringContaining('Heat') });
    expect(byPt.get('seixa')?.en).toBe('Stock dove');
  });

  it('finds for every word the first of its questions whose stem or an option holds the phrase', () => {
    for (const word of words) {
      expect(word.ids).toContain(questionForWord(word)?.id);
    }
    const levantar = words.find((w) => w.pt === 'levantar');
    if (!levantar) throw new Error('levantar missing');
    // Its phrase is question 19's option B with the first letter lowercased.
    const q = questionForWord(levantar);
    expect(q?.id).toBe(19);
    const start = findPhrase(q?.options.B ?? '', levantar.phrase);
    expect(start).toBe(0);
    expect(q?.options.B.slice(start, start + levantar.phrase.length)).toBe('Procurar, perseguir e levantar espécies de caça maior');
    // Question 1 does not hold the phrase, so 19 is still the first that does.
    expect(questionForWord({ ...levantar, ids: [1, 19, 40] })?.id).toBe(19);
    expect(questionForWord({ ...levantar, ids: [1, 2] })).toBeUndefined();
  });

  it('matches a phrase ignoring case and reading curly quotes as straight ones, at its place in the text', () => {
    expect(findPhrase('Uma galinha-d\u2019água', "GALINHA-D'ÁGUA")).toBe(4);
    expect(findPhrase("Uma galinha-d'água", 'galinha-d\u2019água')).toBe(4);
    expect(findPhrase('O \u201cpombo\u201d', '"pombo"')).toBe(2);
    expect(findPhrase('Um gato', 'um cão')).toBe(-1);
  });

  it('matches a phrase only as whole words: a letter, accented or not, a digit or a hyphen next to it is no boundary', () => {
    expect(findPhrase('Listados', 'Listado')).toBe(-1);
    expect(findPhrase('na área da região cinegética', 'a região')).toBe(-1);
    expect(findPhrase('A caçada', 'ada')).toBe(-1);
    expect(findPhrase('Um pato-real', 'pato')).toBe(-1);
    expect(findPhrase('Há 12 meses', '2 meses')).toBe(-1);
    // The first place cut inside a word is passed over for a later whole one.
    expect(findPhrase('da região e a região', 'a região')).toBe(12);
    expect(findPhrase('Listado', 'listado')).toBe(0);
    expect(findPhrase('(Listado)', 'Listado')).toBe(1);
    expect(findPhrase('cinegética a que respeita', 'a que respeita')).toBe(11);
  });

  it("cuts every word's phrase out of its question at word boundaries, never inside a word", () => {
    const inWord = /[\p{L}\p{N}-]/u;
    for (const word of words) {
      const site = wordSite(word);
      if (!site) throw new Error(`no site for ${word.pt}`);
      const text = site.field === 'question' ? site.question.question : site.question.options[site.field];
      const end = site.start + word.phrase.length;
      expect(inWord.test(text.charAt(site.start - 1)), `${word.pt} starts inside a word`).toBe(false);
      expect(inWord.test(text.charAt(end)), `${word.pt} ends inside a word`).toBe(false);
    }
  });
});
