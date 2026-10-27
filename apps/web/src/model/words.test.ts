import type { Word, WordKind } from '@cacador/data';
import { describe, expect, it } from 'vitest';
import { seededRandom, shuffled } from './random';
import { nextWordsOfPass, settleWordPass, wordOptions } from './words';

/** A word of the tests' own list, never one of the real list's. */
const word = (pt: string, en: string, kind: WordKind): Word => ({ pt, phrase: pt, en, kind, ids: [1], note: '' });

const lower = (texts: readonly string[]): string[] => texts.map((t) => t.toLowerCase());

/** A word's options as a list, A to C, after checking the answer's letter holds the word's own English. */
function optionsOf(target: Word, list: readonly Word[], seed: number): string[] {
  const { texts, answer } = wordOptions(target, list, seededRandom(seed));
  expect(texts[answer]).toBe(target.en);
  return [texts.A, texts.B, texts.C];
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('shuffled', () => {
  it('keeps every item once, takes the first count, and leaves the input as it was', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const all = shuffled(items, seededRandom(3));
    expect([...all].sort((a, b) => a - b)).toEqual(items);
    expect(all).not.toEqual(items);
    expect(shuffled(items, seededRandom(3), 5)).toEqual(all.slice(0, 5));
    expect(items).toEqual(Array.from({ length: 30 }, (_, i) => i));
  });
});

describe('wordOptions', () => {
  const lebre = word('lebre', 'Hare', 'species');
  const list = [
    lebre,
    word('lebre-ibérica', 'hare', 'species'),
    word('coelho', 'Rabbit', 'species'),
    word('coelho-bravo', 'rabbit', 'species'),
    word('perdiz', 'Partridge', 'species'),
    word('raposa', 'Fox', 'species'),
    word('toca', 'burrow', 'habitat'),
    word('ninho', 'nest', 'habitat'),
    word('cio', 'rut', 'life'),
    word('ouriço', 'Hedgehog', 'species'),
  ];

  it("gives three different English, its own among them, the others its kind's with an English unlike its own ignoring case", () => {
    const kindEn = new Set(list.filter((w) => w.kind === 'species').map((w) => w.en));
    for (const seed of SEEDS) {
      const options = optionsOf(lebre, list, seed);
      expect(options).toHaveLength(3);
      expect(new Set(lower(options)).size).toBe(3);
      expect(options.filter((en) => en.toLowerCase() === 'hare')).toEqual(['Hare']);
      for (const en of options) expect(kindEn.has(en)).toBe(true);
    }
  });

  it("puts the right answer in each of the three places and draws every other word of the kind", () => {
    const places = new Set<number>();
    const drawn = new Set<string>();
    for (const seed of SEEDS) {
      const options = optionsOf(lebre, list, seed);
      places.add(options.indexOf('Hare'));
      for (const en of options) drawn.add(en);
    }
    expect(places).toEqual(new Set([0, 1, 2]));
    expect(drawn).toEqual(new Set(['Hare', 'Rabbit', 'rabbit', 'Partridge', 'Fox', 'Hedgehog']));
  });

  it('takes the rest from the whole list when the kind cannot supply two', () => {
    const toca = list[6] as Word;
    const cio = list[8] as Word;
    for (const seed of SEEDS) {
      const one = optionsOf(toca, list, seed);
      expect(one).toHaveLength(3);
      expect(one).toContain('burrow');
      expect(one).toContain('nest');
      expect(new Set(lower(one)).size).toBe(3);

      const none = optionsOf(cio, list, seed);
      expect(none).toHaveLength(3);
      expect(none).toContain('rut');
      expect(new Set(lower(none)).size).toBe(3);
    }
  });

  it('gives the same options in the same order for the same seed', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(optionsOf(lebre, list, seed)).toEqual(optionsOf(lebre, list, seed));
    }
    const orders = new Set(SEEDS.slice(0, 20).map((seed) => optionsOf(lebre, list, seed).join('|')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('leaves a row empty only when the whole list cannot supply two', () => {
    const tiny = [word('a', 'one', 'law'), word('b', 'ONE', 'law'), word('c', 'two', 'time')];
    expect(optionsOf(tiny[0] as Word, tiny, 1).sort()).toEqual(['', 'one', 'two']);
  });
});

describe('settleWordPass', () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((pt) => word(pt, pt.toUpperCase(), 'general'));

  it('drops removed and repeated words, counting only the spent ones that stay', () => {
    const pass = settleWordPass({ order: ['a', 'gone', 'a', 'b', 'c', 'd', 'e'], place: 3, ahead: ['gone'] }, list, seededRandom(1));
    expect(pass).toEqual({ order: ['a', 'b', 'c', 'd', 'e'], place: 1, ahead: [] });
  });

  it('starts the next pass, the ahead words first, when every word left is spent', () => {
    const pass = settleWordPass({ order: ['a', 'b', 'c', 'd', 'e', 'gone'], place: 5, ahead: ['c', 'a'] }, list, seededRandom(1));
    expect(pass.place).toBe(0);
    expect(pass.order.slice(0, 2)).toEqual(['c', 'a']);
    expect([...pass.order].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('never gives more words than the list holds', () => {
    const { words } = nextWordsOfPass(settleWordPass(undefined, list, seededRandom(2)), list, 10, seededRandom(2));
    expect(words.map((w) => w.pt).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
