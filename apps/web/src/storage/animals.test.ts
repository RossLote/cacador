import { animalBySlug, type Animal } from '@cacador/data';
import { describe, expect, it, vi } from 'vitest';
import { ANIMALS_KEY, LOCALE_KEY } from './keys';
import type { AnimalsProgress } from './types';

const boar = animalBySlug('javali') as Animal;
const T0 = Date.UTC(2026, 10, 10, 9, 0);

/** The storage module anew, as after a reload, so the copy it keeps in memory starts empty. */
async function reload() {
  vi.resetModules();
  const [animals, storage] = await Promise.all([import('./animals'), import('./index')]);
  return { ...animals, closeStorage: storage.closeStorage, clearProgress: storage.clearProgress };
}

type Module = Awaited<ReturnType<typeof reload>>;

/** Answers the boar's questions in order, right or wrong as `answers` says; the last answer's result. */
function answer(m: Module, answers: readonly boolean[], at = T0) {
  return answers.map((correct) => m.recordPassAnswer('javali', correct, at)).at(-1);
}

const stored = (): unknown => JSON.parse(localStorage.getItem(ANIMALS_KEY) ?? 'null');

const blockWebStorage = (): void => {
  const blocked = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
};

describe('the animals progress', () => {
  it('has 22 questions for the boar, from 123', () => {
    expect(boar.questionIds).toHaveLength(22);
    expect(boar.questionIds.slice(0, 3)).toEqual([123, 124, 125]);
  });

  it('keeps a pass left partway, across a reload', async () => {
    let m = await reload();
    expect(m.readAnimals()).toEqual({});
    expect(answer(m, [true, false, true])).toEqual({ finished: false, pass: { answered: 3, right: 2, missed: [124] } });
    expect(m.readAnimals()).toEqual({ javali: { pass: { answered: 3, right: 2, missed: [124] } } });

    m = await reload();
    expect(m.readAnimals()).toEqual({ javali: { pass: { answered: 3, right: 2, missed: [124] } } });
    expect(m.recordPassAnswer('javali', false)).toEqual({ finished: false, pass: { answered: 4, right: 2, missed: [124, 126] } });
  });

  it('turns the pass into the score at its 22nd answer, leaving no pass', async () => {
    const m = await reload();
    const answers = boar.questionIds.map((_, i) => i % 5 !== 1);
    expect(answer(m, answers.slice(0, 21))).toMatchObject({ finished: false, pass: { answered: 21 } });
    const missed = boar.questionIds.filter((_, i) => i % 5 === 1);
    const last = { right: 22 - missed.length, total: 22, at: T0 + 1 };

    expect(m.recordPassAnswer('javali', answers[21] as boolean, T0 + 1)).toEqual({ finished: true, score: last, missed });
    expect(m.readAnimals()).toEqual({ javali: { last } });
    expect(stored()).toEqual({ javali: { last } });

    // The next pass starts again at question 1 and leaves the score as it was until it finishes.
    expect(m.recordPassAnswer('javali', true)).toEqual({ finished: false, pass: { answered: 1, right: 1, missed: [] } });
    expect(m.readAnimals()).toEqual({ javali: { last, pass: { answered: 1, right: 1, missed: [] } } });
  });

  it('restarts the pass from question 1 and keeps the score (Go again)', async () => {
    const m = await reload();
    answer(m, boar.questionIds.map(() => true));
    answer(m, [false, true], T0 + 1);
    m.restartPass('javali');
    expect(m.readAnimals()).toEqual({ javali: { last: { right: 22, total: 22, at: T0 } } });
    expect(m.recordPassAnswer('javali', false)).toEqual({ finished: false, pass: { answered: 1, right: 0, missed: [123] } });

    // An animal with only a pass is gone once it restarts.
    m.recordPassAnswer('coelho', true);
    m.restartPass('coelho');
    expect(Object.keys(m.readAnimals())).toEqual(['javali']);
  });

  it('reads a garbled value, an unknown slug and a pass past the end as none, without an error', async () => {
    const last = { right: 17, total: 22, at: T0 };
    const values: [string, AnimalsProgress][] = [
      ['{not json', {}],
      ['null', {}],
      ['[]', {}],
      ['{"javali":"boar"}', {}],
      [JSON.stringify({ lobo: { last } }), {}],
      [JSON.stringify({ javali: { pass: { answered: 22, right: 22, missed: [] } } }), {}],
      [JSON.stringify({ javali: { last, pass: { answered: 30, right: 30, missed: [] } } }), { javali: { last } }],
      [JSON.stringify({ javali: { pass: { answered: 3, right: 2, missed: [200] } } }), {}],
      [JSON.stringify({ javali: { pass: { answered: 3, right: 1, missed: [124] } } }), {}],
      [JSON.stringify({ javali: { last: { right: 23, total: 22, at: T0 } }, coelho: { last } }), { coelho: { last } }],
      [JSON.stringify({ javali: { last: { right: 0, total: 0, at: T0 } } }), {}],
    ];
    for (const [value, expected] of values) {
      localStorage.setItem(ANIMALS_KEY, value);
      const m = await reload();
      expect(m.readAnimals()).toEqual(expected);
    }

    // A dropped pass starts the animal from question 1.
    localStorage.setItem(ANIMALS_KEY, JSON.stringify({ javali: { pass: { answered: 22, right: 22, missed: [] } } }));
    const m = await reload();
    expect(m.recordPassAnswer('javali', false)).toEqual({ finished: false, pass: { answered: 1, right: 0, missed: [123] } });
  });

  it('holds the value in memory for the page while localStorage is blocked, and Clear progress forgets it', async () => {
    blockWebStorage();
    const m = await reload();
    try {
      answer(m, [true, false, true]);
      expect(m.readAnimals()).toEqual({ javali: { pass: { answered: 3, right: 2, missed: [124] } } });
      answer(m, [false]);
      expect(m.readAnimals()).toEqual({ javali: { pass: { answered: 4, right: 2, missed: [124, 126] } } });

      await m.clearProgress();
      expect(m.readAnimals()).toEqual({});
    } finally {
      await m.closeStorage();
    }
  });

  it('is removed by Clear progress, which keeps the language', async () => {
    const m = await reload();
    try {
      answer(m, boar.questionIds.map(() => true));
      answer(m, [true, false]);
      localStorage.setItem(LOCALE_KEY, 'pt');
      expect(localStorage.getItem(ANIMALS_KEY)).not.toBeNull();

      await m.clearProgress();
      expect(localStorage.getItem(ANIMALS_KEY)).toBeNull();
      expect(m.readAnimals()).toEqual({});
      expect(localStorage.getItem(LOCALE_KEY)).toBe('pt');
    } finally {
      await m.closeStorage();
    }
  });
});
