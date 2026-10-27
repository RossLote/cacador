/** The twelve kinds of DESIGN.md § 3.3, each the file words/<kind>.json. */
export const WORD_KINDS: readonly [
  'anatomy', 'dog', 'falconry', 'general', 'ground', 'habitat',
  'law', 'life', 'method', 'species', 'time', 'weapon',
];

/** Curly apostrophes and quotes become straight ones, so a glossary name matches the bank's typography. */
export function straighten(text: string): string;

/** Where `phrase` starts in `text`, ignoring case and reading curly quotes as straight ones, or -1; the index cuts the phrase out of `text`. */
export function findPhrase(text: string, phrase: string): number;
