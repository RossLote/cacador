// The words list's kinds and the text matching the validator and the loader share (DESIGN.md § 3.3,
// § 4 rules 6 and 9). Pure, with no node import, so src/index.ts can bring it into the app.

/** The twelve kinds of DESIGN.md § 3.3, each the file words/<kind>.json. */
export const WORD_KINDS = [
  'anatomy', 'dog', 'falconry', 'general', 'ground', 'habitat',
  'law', 'life', 'method', 'species', 'time', 'weapon',
];

/** Curly apostrophes and quotes become straight ones, so a glossary name matches the bank's typography. */
export const straighten = (text) => text.replace(/’/g, "'").replace(/[“”]/g, '"');

/**
 * Where `phrase` starts in `text`, ignoring case and reading curly quotes as straight ones, or -1.
 * Both changes keep every character in place, so the index and the phrase's length cut the phrase
 * out of `text` as the bank prints it.
 */
export const findPhrase = (text, phrase) => straighten(text).toLowerCase().indexOf(straighten(phrase).toLowerCase());
