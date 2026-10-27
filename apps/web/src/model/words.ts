import type { OptionKey, Word } from '@cacador/data';
import { shuffled, type RandomSource } from './random';

/**
 * The words drill (DESIGN.md § 6.11): the shuffled pass over the list (D12) and
 * a word's three options (D11). A word is known by its `pt`, unique across the
 * list (§ 4 rule 9). Every function takes the list, so the tests bring their own.
 */

/** Words in a round of the drill: always ten (D10). */
export const WORD_ROUND_SIZE = 10;

/**
 * The place in the pass, as `cacador.words` keeps it (D12, D13): `order` is the
 * pass, every word's pt once, of which the first `place` are spent (answered);
 * `ahead` is the start of the next pass, set once a round runs past the end of
 * this one, so the next pass opens on the words that round already shows.
 */
export interface WordPass {
  order: string[];
  place: number;
  ahead: string[];
}

/** A new pass over the list: the `ahead` words still in it first, then the rest shuffled. */
function startPass(list: readonly Word[], random: RandomSource, ahead: readonly string[] = []): WordPass {
  const inList = new Set(list.map((w) => w.pt));
  const head = [...new Set(ahead)].filter((pt) => inList.has(pt));
  const inHead = new Set(head);
  const rest = list.map((w) => w.pt).filter((pt) => !inHead.has(pt));
  return { order: [...head, ...shuffled(rest, random)], place: 0, ahead: [] };
}

/**
 * The stored pass brought up to date with the list (D12): none stored (a fresh
 * device, a garbled value) starts a fresh pass; a removed word is dropped; an
 * added word goes to a random place in the unseen part; a spent pass gives way
 * to the next.
 */
export function settleWordPass(stored: WordPass | undefined, list: readonly Word[], random: RandomSource): WordPass {
  if (stored === undefined) return startPass(list, random);
  const inList = new Set(list.map((w) => w.pt));
  const order: string[] = [];
  const inOrder = new Set<string>();
  let place = 0;
  for (const [i, pt] of stored.order.entries()) {
    if (!inList.has(pt) || inOrder.has(pt)) continue;
    order.push(pt);
    inOrder.add(pt);
    if (i < stored.place) place++;
  }
  for (const { pt } of list) {
    if (inOrder.has(pt)) continue;
    order.splice(place + Math.floor(random() * (order.length - place + 1)), 0, pt);
    inOrder.add(pt);
  }
  const unseen = new Set(order.slice(place));
  const ahead = [...new Set(stored.ahead)].filter((pt) => inList.has(pt) && !unseen.has(pt));
  return place < order.length ? { order, place, ahead } : startPass(list, random, ahead);
}

/**
 * The next `count` words of a settled pass, without spending them (D12): the
 * unseen words in order, then, when they are fewer, the start of the next pass,
 * drawn from the spent words and kept in the returned pass's `ahead`, so no
 * word comes twice. Never more words than the list holds.
 */
export function nextWordsOfPass(
  pass: WordPass,
  list: readonly Word[],
  count: number,
  random: RandomSource,
): { pass: WordPass; words: Word[] } {
  const byPt = new Map(list.map((w) => [w.pt, w]));
  const unseen = pass.order.slice(pass.place, pass.place + count);
  const fromNext = Math.min(count, byPt.size) - unseen.length;
  let ahead = pass.ahead;
  if (fromNext > ahead.length) {
    const taken = new Set([...unseen, ...ahead]);
    const spent = pass.order.filter((pt) => !taken.has(pt));
    ahead = [...ahead, ...shuffled(spent, random, fromNext - ahead.length)];
  }
  const pts = [...unseen, ...ahead.slice(0, Math.max(0, fromNext))];
  return { pass: { ...pass, ahead }, words: pts.flatMap((pt) => byPt.get(pt) ?? []) };
}

/**
 * The settled pass once the word is answered (D12): the word takes the place
 * and the place moves on; the end of the pass starts the next, opening on
 * `ahead`. A word not unseen in this pass changes nothing.
 */
export function spendWordOfPass(pass: WordPass, pt: string, list: readonly Word[], random: RandomSource): WordPass {
  const at = pass.order.indexOf(pt, pass.place);
  if (at === -1) return pass;
  const order = pass.order.filter((other) => other !== pt);
  order.splice(pass.place, 0, pt);
  const place = pass.place + 1;
  return place < order.length ? { ...pass, order, place } : startPass(list, random, pass.ahead);
}

/** A word's three options as drawn: the English by letter, and the letter of the word's own. */
export interface WordOptions {
  texts: Record<OptionKey, string>;
  answer: OptionKey;
}

/**
 * A word's options, A to C (D11): its own English and two others drawn at
 * random from the words of its kind whose English differs, ignoring case,
 * from its own and from each other, the rest from the whole list when the kind
 * cannot supply two; the right answer's place is random. A row is empty only
 * when the whole list cannot supply two.
 */
export function wordOptions(word: Word, list: readonly Word[], random: RandomSource = Math.random): WordOptions {
  const options = [word.en];
  const used = new Set([word.en.toLowerCase()]);
  const drawFrom = (words: readonly Word[]): void => {
    for (const other of shuffled(words, random)) {
      if (options.length === 3) return;
      if (used.has(other.en.toLowerCase())) continue;
      used.add(other.en.toLowerCase());
      options.push(other.en);
    }
  };
  drawFrom(list.filter((w) => w.kind === word.kind));
  if (options.length < 3) drawFrom(list);
  const order = shuffled(options, random);
  const [A = '', B = '', C = ''] = order;
  // The word's own English is in the list once, and no other option equals it.
  const answer = (['A', 'B', 'C'] as const)[order.indexOf(word.en)] ?? 'A';
  return { texts: { A, B, C }, answer };
}
