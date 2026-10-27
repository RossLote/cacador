import { wordSite, type Word } from '@cacador/data';

/** The sentence the panel shows after answering (DESIGN.md § 6.11), with where the word's phrase sits in it. */
export interface Sentence {
  /** The question it comes from, the first of the word's ids whose text holds the phrase. */
  id: number;
  /** The question's stem, or the stem followed by the option that holds the phrase, as the bank prints them. */
  text: string;
  /** Where the phrase starts in `text`; it runs for the phrase's length. */
  start: number;
  end: number;
}

/**
 * The word's sentence: the stem when it holds the phrase, else the stem, a
 * space and the first option (A, B, C) that does, so the phrase is cut out of
 * the text as the bank prints it. Undefined only for a word none of whose
 * questions holds its phrase, which validator rule 9 never lets in.
 */
export function sentenceFor(word: Word): Sentence | undefined {
  const site = wordSite(word);
  if (site === undefined) return undefined;
  const { question, field, start } = site;
  const prefix = field === 'question' ? '' : `${question.question} `;
  const text = prefix + (field === 'question' ? question.question : question.options[field]);
  const at = prefix.length + start;
  return { id: question.id, text, start: at, end: at + word.phrase.length };
}
