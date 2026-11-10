/**
 * The Animals screen's progress (animal practice D12, D13, D22): per animal, the
 * score of the latest full pass and the full pass left partway, one JSON value
 * in localStorage under ANIMALS_KEY, kept in memory for the page's life when
 * localStorage cannot hold it, as words.ts keeps the words pass. A stored value
 * is read entry by entry: an unknown animal, or a score or pass that is not well
 * formed, reads as none, so a garbled pass starts the animal from question 1.
 * Clear progress forgets it, the memory copy too.
 *
 * Only full passes come here: a "Missed ones only" pass is never kept and never
 * changes the score (D20). The answers themselves go to the answers log through
 * `recordAnswer`, as Practice's do.
 */
import { animalBySlug, type Animal } from '@cacador/data';
import { ANIMALS_KEY } from './keys';
import type { AnimalPass, AnimalProgress, AnimalScore, AnimalsProgress } from './types';
import { webStorageSlot } from './webStorageSlot';

type Fields = Record<string, unknown>;

const asFields = (value: unknown): Fields | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : undefined;

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

/** A full pass's score: `0 ≤ right ≤ total`, `total ≥ 1`, `at` a finite time; undefined otherwise. */
function wellFormedScore(value: unknown): AnimalScore | undefined {
  const f = asFields(value);
  if (f === undefined) return undefined;
  const { right, total, at } = f;
  if (!isCount(right) || !isCount(total) || total < 1 || right > total) return undefined;
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined;
  return { right, total, at };
}

/**
 * A pass left partway through `animal`: `1 ≤ answered <` its question count,
 * `right ≤ answered`, and `missed` the `answered − right` distinct ids answered
 * wrongly among its first `answered` questions, put in the order asked;
 * undefined otherwise.
 */
function wellFormedPass(animal: Animal, value: unknown): AnimalPass | undefined {
  const f = asFields(value);
  if (f === undefined) return undefined;
  const { answered, right, missed } = f;
  if (!isCount(answered) || answered < 1 || answered >= animal.questionIds.length) return undefined;
  if (!isCount(right) || right > answered) return undefined;
  if (!Array.isArray(missed) || missed.length !== answered - right || new Set(missed).size !== missed.length) return undefined;
  const asked = animal.questionIds.slice(0, answered);
  if (!missed.every((id) => typeof id === 'number' && asked.includes(id))) return undefined;
  return { answered, right, missed: asked.filter((id) => missed.includes(id)) };
}

/**
 * One stored or imported entry, rebuilt from its known fields: what of it is
 * well formed, and whether all of it was. An unknown slug, a value that is not
 * an object, a bad `last` or `pass`, or an entry holding neither is not
 * flawless; the parts that are well formed are kept in `progress` all the same.
 */
export function readAnimalEntry(slug: string, value: unknown): { progress: AnimalProgress; flawless: boolean } {
  const animal = animalBySlug(slug);
  const f = asFields(value);
  if (animal === undefined || f === undefined) return { progress: {}, flawless: false };
  const progress: AnimalProgress = {};
  let flawless = f.last !== undefined || f.pass !== undefined;
  if (f.last !== undefined) {
    const last = wellFormedScore(f.last);
    if (last === undefined) flawless = false;
    else progress.last = last;
  }
  if (f.pass !== undefined) {
    const pass = wellFormedPass(animal, f.pass);
    if (pass === undefined) flawless = false;
    else progress.pass = pass;
  }
  return { progress, flawless };
}

const isEmpty = (progress: AnimalProgress): boolean => progress.last === undefined && progress.pass === undefined;

/** The stored value with what is not well formed dropped, entry by entry; undefined when it is not an object at all. */
function parseAnimals(stored: unknown): AnimalsProgress | undefined {
  const f = asFields(stored);
  if (f === undefined) return undefined;
  const progress: AnimalsProgress = {};
  for (const [slug, value] of Object.entries(f)) {
    const entry = readAnimalEntry(slug, value).progress;
    if (!isEmpty(entry)) progress[slug] = entry;
  }
  return progress;
}

const slot = webStorageSlot('localStorage', ANIMALS_KEY, parseAnimals);

/** Stores `progress`, or removes the key when no animal has anything. */
function write(progress: AnimalsProgress): void {
  if (Object.keys(progress).length === 0) slot.clear();
  else slot.write(progress);
}

/** Every animal's latest full-pass score and kept pass, by slug; an animal with neither has no entry. */
export function readAnimals(): AnimalsProgress {
  return slot.read() ?? {};
}

/** What a full pass's answer did: the pass so far, or, at its last question, the score and the ids answered wrongly. */
export type PassAnswerResult = { finished: false; pass: AnimalPass } | { finished: true; score: AnimalScore; missed: number[] };

/**
 * Adds an answer to the animal's full pass, starting one when there is none
 * (D12). The question answered is the animal's `questionIds[answered]`. At the
 * pass's last question the score becomes the animal's `last`, finished at `at`,
 * and the pass is removed (D13, D22), so closing the app there keeps the score.
 */
export function recordPassAnswer(slug: string, correct: boolean, at: number = Date.now()): PassAnswerResult {
  const animal = animalBySlug(slug);
  if (animal === undefined) throw new Error(`No animal ${slug}`);
  const progress = readAnimals();
  const own = progress[slug] ?? {};
  const before = own.pass ?? { answered: 0, right: 0, missed: [] };
  const questionId = animal.questionIds[before.answered] as number;
  const pass: AnimalPass = {
    answered: before.answered + 1,
    right: before.right + (correct ? 1 : 0),
    missed: correct ? [...before.missed] : [...before.missed, questionId],
  };
  if (pass.answered < animal.questionIds.length) {
    write({ ...progress, [slug]: { ...own, pass } });
    return { finished: false, pass };
  }
  const score: AnimalScore = { right: pass.right, total: pass.answered, at };
  write({ ...progress, [slug]: { last: score } });
  return { finished: true, score, missed: pass.missed };
}

/** Removes the animal's kept pass and keeps its score: Go again starts from question 1 (D12). */
export function restartPass(slug: string): void {
  const progress = readAnimals();
  const own = progress[slug];
  if (own?.pass === undefined) return;
  if (own.last === undefined) delete progress[slug];
  else progress[slug] = { last: own.last };
  write(progress);
}

/**
 * Merges an imported file's animals into the device's (D22): per animal the
 * score finished later wins, the device's own on a tie, and the file's kept
 * pass comes in only where the device holds none. `incoming` is already
 * checked (`validateExportFile`).
 */
export function mergeAnimals(incoming: AnimalsProgress): void {
  const progress = readAnimals();
  for (const [slug, theirs] of Object.entries(incoming)) {
    if (animalBySlug(slug) === undefined) continue;
    const own = progress[slug] ?? {};
    const merged: AnimalProgress = {};
    const last = own.last !== undefined && theirs.last !== undefined && theirs.last.at <= own.last.at ? own.last : (theirs.last ?? own.last);
    const pass = own.pass ?? theirs.pass;
    if (last !== undefined) merged.last = last;
    if (pass !== undefined) merged.pass = pass;
    if (!isEmpty(merged)) progress[slug] = merged;
  }
  write(progress);
}

/** Forgets every score and kept pass, stored or in memory (Clear progress, D13). */
export function clearAnimals(): void {
  slot.clear();
}
