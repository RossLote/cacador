import type { Word, WordKind } from '@cacador/data';
import { describe, expect, it, vi } from 'vitest';
import { seededRandom, type RandomSource } from '@/model';
import { LOCALE_KEY, WORDS_KEY } from './keys';

const KINDS: WordKind[] = ['species', 'law', 'time'];

/** The tests' own list of `size` words, never the real one, which other beads keep changing. */
const makeList = (size: number, prefix = 'palavra'): Word[] =>
  Array.from({ length: size }, (_, i) => ({
    pt: `${prefix}-${i}`,
    phrase: `${prefix}-${i}`,
    en: `${prefix} ${i}`,
    kind: KINDS[i % KINDS.length] as WordKind,
    ids: [i + 1],
    note: '',
  }));

const LIST = makeList(25);

/** The storage module anew, as after a reload, so the pass it keeps in memory starts empty. */
async function reload() {
  vi.resetModules();
  const [words, storage] = await Promise.all([import('./words'), import('./index')]);
  return { ...words, closeStorage: storage.closeStorage, clearProgress: storage.clearProgress, exportProgress: storage.exportProgress };
}

type Module = Awaited<ReturnType<typeof reload>>;

const pts = (words: readonly Word[]): string[] => words.map((w) => w.pt);

/** A round's words, the first `answered` of them answered; the round's words as pts. */
function playRound(m: Module, list: readonly Word[], random: RandomSource, answered = 10): string[] {
  const round = m.nextRoundWords(list, random);
  for (const word of round.slice(0, answered)) m.spendWord(list, word, random);
  return pts(round);
}

/** `rounds` whole rounds, every word answered; the words in the order shown. */
function playRounds(m: Module, list: readonly Word[], random: RandomSource, rounds: number): string[] {
  return Array.from({ length: rounds }, () => playRound(m, list, random)).flat();
}

const blockWebStorage = (): void => {
  const blocked = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
};

describe('the words pass', () => {
  it('walks every word of the list before any comes again, ten different words a round, past the end of a pass too', async () => {
    const m = await reload();
    const random = seededRandom(1);
    const rounds = Array.from({ length: 8 }, () => playRound(m, LIST, random));
    for (const round of rounds) expect(new Set(round).size).toBe(10);
    const shown = rounds.flat();
    for (let start = 0; start + LIST.length <= shown.length; start += LIST.length) {
      expect(new Set(shown.slice(start, start + LIST.length))).toEqual(new Set(pts(LIST)));
    }
  });

  it('brings back a word shown in a round left after three answers, never the three answered', async () => {
    const m = await reload();
    const random = seededRandom(2);
    const left = playRound(m, LIST, random, 3);
    const next = pts(m.nextRoundWords(LIST, random));
    expect(next.slice(0, 7)).toEqual(left.slice(3));
    for (const answered of left.slice(0, 3)) expect(next).not.toContain(answered);
    expect(new Set(next).size).toBe(10);
  });

  it('carries on at the same place after a reload, past the end of a pass too', async () => {
    let m = await reload();
    playRound(m, LIST, seededRandom(3), 4);
    const before = pts(m.nextRoundWords(LIST, seededRandom(4)));
    m = await reload();
    expect(pts(m.nextRoundWords(LIST, seededRandom(5)))).toEqual(before);

    // 4 + 10 + 10 answered leave one word of the pass of 25: the round runs into the next pass.
    playRounds(m, LIST, seededRandom(6), 2);
    const across = pts(m.nextRoundWords(LIST, seededRandom(7)));
    expect(new Set(across).size).toBe(10);
    m = await reload();
    expect(pts(m.nextRoundWords(LIST, seededRandom(8)))).toEqual(across);
    for (const pt of across) m.spendWord(LIST, LIST.find((w) => w.pt === pt) as Word, seededRandom(9));
    const after = playRounds(m, LIST, seededRandom(10), 2).slice(0, 16);
    // The nine shown from the new pass are spent in it: the 16 left of that pass are the others.
    expect(new Set([...across.slice(1), ...after])).toEqual(new Set(pts(LIST)));
  });

  it('shows a word added mid-pass before the pass ends, and a removed one never', async () => {
    const m = await reload();
    const random = seededRandom(11);
    const spent = playRound(m, LIST, random);
    const removed = pts(m.nextRoundWords(LIST, random)).slice(0, 2);
    const added = makeList(3, 'nova');
    const list = [...LIST.filter((w) => !removed.includes(w.pt)), ...added];

    const shown = playRounds(m, list, random, 5);
    const restOfPass = list.length - spent.length;
    expect(new Set(shown.slice(0, restOfPass))).toEqual(new Set(pts(list).filter((pt) => !spent.includes(pt))));
    for (const pt of pts(added)) expect(shown.slice(0, restOfPass)).toContain(pt);
    for (const pt of removed) expect(shown).not.toContain(pt);
    expect(new Set(shown.slice(restOfPass, restOfPass + list.length))).toEqual(new Set(pts(list)));
  });

  it('starts a fresh pass, without an error, from a garbled stored value', async () => {
    const fresh = pts((await reload()).nextRoundWords(LIST, seededRandom(12)));
    const garbled = [
      '{not json',
      'null',
      '[]',
      '{"order":[1,2],"place":0,"ahead":[]}',
      '{"order":["palavra-1"],"place":3,"ahead":[]}',
      '{"order":["palavra-1"],"place":0}',
    ];
    for (const value of garbled) {
      localStorage.setItem(WORDS_KEY, value);
      const m = await reload();
      expect(pts(m.nextRoundWords(LIST, seededRandom(12)))).toEqual(fresh);
      expect((JSON.parse(localStorage.getItem(WORDS_KEY) ?? 'null') as { order: string[] }).order).toHaveLength(LIST.length);
    }
  });

  it('holds the pass in memory for the page while Web Storage is blocked, and Clear progress forgets it', async () => {
    const fresh = pts((await reload()).nextRoundWords(LIST, seededRandom(13)));
    localStorage.clear();
    blockWebStorage();
    const m = await reload();
    try {
      expect(pts(m.nextRoundWords(LIST, seededRandom(13)))).toEqual(fresh);
      const left = playRound(m, LIST, seededRandom(14), 3);
      expect(pts(m.nextRoundWords(LIST, seededRandom(15))).slice(0, 7)).toEqual(left.slice(3));

      await m.clearProgress();
      expect(pts(m.nextRoundWords(LIST, seededRandom(13)))).toEqual(fresh);
    } finally {
      await m.closeStorage();
    }
  });

  it('is removed by Clear progress, which keeps the language', async () => {
    const m = await reload();
    try {
      playRound(m, LIST, seededRandom(16), 3);
      localStorage.setItem(LOCALE_KEY, 'pt');
      expect(localStorage.getItem(WORDS_KEY)).not.toBeNull();
      await m.clearProgress();
      expect(localStorage.getItem(WORDS_KEY)).toBeNull();
      expect(localStorage.getItem(LOCALE_KEY)).toBe('pt');
    } finally {
      await m.closeStorage();
    }
  });

  it('leaves the export file as it was: version 1, the same six fields, no word in it', async () => {
    const m = await reload();
    try {
      playRounds(m, LIST, seededRandom(17), 3);
      const file = await m.exportProgress();
      expect(Object.keys(file).sort()).toEqual(['answers', 'app', 'exams', 'exportedAt', 'flags', 'version']);
      expect(file.version).toBe(1);
      expect(JSON.stringify(file)).not.toContain('palavra');
    } finally {
      await m.closeStorage();
    }
  });
});
