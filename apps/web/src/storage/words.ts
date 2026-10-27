/**
 * The words drill's place (D12, D13): the shuffled pass of the study model's
 * WordPass as JSON in localStorage under WORDS_KEY, so a reload, Another 10 or
 * a later visit carries on at the first unanswered word. A garbled stored value
 * reads as none, which starts a fresh pass. When localStorage cannot hold the
 * pass (blocked site data), it is kept in memory for the page's life instead,
 * and Clear progress forgets that copy too, as recent.ts keeps its window.
 *
 * The screen's use: `nextRoundWords(words)` once at the start of each round for
 * its ten words, and `spendWord(words, word)` as each is answered. Both take the
 * list, the loader's `words` in the app, and a random source for the shuffles.
 */
import type { Word } from '@cacador/data';
import { nextWordsOfPass, settleWordPass, spendWordOfPass, WORD_ROUND_SIZE, type RandomSource, type WordPass } from '@/model';
import { WORDS_KEY } from './keys';

/** The pass as last written while localStorage could not hold it; undefined while storage holds it. */
let unstored: WordPass | undefined;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Whether a parsed value has the WordPass shape, its place inside its order. */
function isWordPass(value: unknown): value is WordPass {
  if (typeof value !== 'object' || value === null) return false;
  const { order, place, ahead } = value as Record<string, unknown>;
  return (
    isStrings(order) && isStrings(ahead) && typeof place === 'number' && Number.isInteger(place) && place >= 0 && place <= order.length
  );
}

/** The stored pass; undefined when there is none or the stored copy is garbled. */
function readWordPass(): WordPass | undefined {
  if (unstored !== undefined) return unstored;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(WORDS_KEY) ?? 'null');
    return isWordPass(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Replaces the pass, in localStorage when it can hold it and in memory otherwise. */
function writeWordPass(pass: WordPass): void {
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(pass));
    unstored = undefined;
  } catch {
    unstored = pass;
  }
}

/**
 * The round's ten words in order, none twice, without spending any (D12): the
 * first unanswered words of the pass, then, past its end, the start of the next
 * pass, which is kept so a reload shows the same ten. Fewer only when the list
 * holds fewer than ten.
 */
export function nextRoundWords(list: readonly Word[], random: RandomSource = Math.random): Word[] {
  const { pass, words } = nextWordsOfPass(settleWordPass(readWordPass(), list, random), list, WORD_ROUND_SIZE, random);
  writeWordPass(pass);
  return words;
}

/** Spends an answered word, right or wrong (D12); the pass's last spent word starts the next pass. */
export function spendWord(list: readonly Word[], word: Word, random: RandomSource = Math.random): void {
  writeWordPass(spendWordOfPass(settleWordPass(readWordPass(), list, random), word.pt, list, random));
}

/** Forgets the pass, stored or in memory (Clear progress, D13). */
export function clearWordPass(): void {
  unstored = undefined;
  try {
    globalThis.localStorage?.removeItem(WORDS_KEY);
  } catch {
    // Web Storage blocked: the memory copy above was the only pass.
  }
}
