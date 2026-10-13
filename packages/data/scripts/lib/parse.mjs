// The pure text parsing of the extractor (DESIGN.md § 2.2): no file or process access.
export const LETTERS = ['A', 'B', 'C'];
const OPTION_LINE = /^([ABC])\) ?(.*)$/;

export class ExtractError extends Error {}
export const fail = (message) => {
  throw new ExtractError(message);
};

/** Collapses every run of whitespace (U+0085 included, which \s misses) to one space and trims. */
export const clean = (s) => s.replace(/[\s\u0085]+/g, ' ').trim();

/** Fails on empty text or a stray "*" (the marker is never part of the text). */
export function checkText(where, text) {
  if (text === '' || text.includes('*')) fail(`${where}: empty text or stray "*" in "${text}"`);
}

/** Lines of a pdftotext dump with their 1-based page (pages are separated by a form feed). */
export const toLines = (text) =>
  text.split('\f').flatMap((page, i) => page.split('\n').map((text) => ({ page: i + 1, text })));

/** Join wrapped pieces; a piece ending in "-" is a hyphenated word split by the wrap (no space). */
function joinPieces(pieces) {
  return pieces.reduce((acc, piece) => (acc === '' ? piece : acc.endsWith('-') ? acc + piece : `${acc} ${piece}`), '');
}

/** Parses the text into `total` questions with contiguous ids from 1, each under its section. */
export function parseQuestions(lines, manifest, total) {
  const headings = new Set(manifest.sections.map((s) => s.heading));
  const questions = [];
  let seen = 0;
  let section = null;
  let q = null;
  let nextId = 1;

  const finish = () => {
    if (!q) return;
    const where = `question ${q.id} (page ${q.page})`;
    if (q.options.length !== LETTERS.length) fail(`${where}: expected 3 options, found ${q.options.length}`);
    const marked = q.options.filter((o) => o.marked);
    if (marked.length !== 1) fail(`${where}: expected exactly one option marked *, found ${marked.length}`);
    const stem = joinPieces(q.stem);
    const options = q.options.map((o) => joinPieces(o.pieces));
    for (const text of [stem, ...options]) checkText(where, text);
    questions.push({ id: q.id, page: q.page, section: q.section, stem, options, answer: marked[0].letter });
    q = null;
  };

  for (const { page, text } of lines) {
    const line = clean(text);
    if (line === '') continue;
    if (headings.has(line)) {
      finish();
      const expected = manifest.sections[seen];
      if (line !== expected?.heading) fail(`page ${page}: heading "${line}" found, expected "${expected?.heading}"`);
      section = expected;
      seen += 1;
      continue;
    }
    if (!section) continue; // the intro before the first heading

    const start = /^(\d+) ?[-–] ?(.*)$/.exec(line);
    if (start && Number(start[1]) === nextId) {
      finish();
      if (nextId < section.from || nextId > section.to) {
        fail(`page ${page}: question ${nextId} falls outside section "${section.heading}" (${section.from}-${section.to})`);
      }
      q = { id: nextId, page, section, stem: [], options: [] };
      nextId += 1;
      if (start[2] !== '') q.stem.push(start[2]);
      continue;
    }
    if (!q) fail(`page ${page}: text "${line}" outside any question (expected question ${nextId})`);

    // A trailing "*" marks the correct option; it may follow a space or be glued to the word.
    const marked = line.endsWith('*');
    const body = marked ? line.slice(0, -1).trimEnd() : line;
    const option = OPTION_LINE.exec(body);
    if (option && option[1] === LETTERS[q.options.length]) {
      q.options.push({ letter: option[1], pieces: option[2] === '' ? [] : [option[2]], marked });
    } else if (q.options.length === 0) {
      if (marked) fail(`question ${q.id} (page ${page}): "*" in the stem`);
      q.stem.push(body);
    } else {
      // A lone "*" under a wrapped option leaves an empty body: it marks, but adds no text.
      const current = q.options[q.options.length - 1];
      if (body !== '') current.pieces.push(body);
      current.marked ||= marked;
    }
  }
  finish();

  if (questions.length !== total) {
    const last = questions.at(-1);
    fail(`parsed ${questions.length} questions, expected ${total} (last parsed: question ${last?.id} on page ${last?.page}, next expected id ${nextId})`);
  }
  if (seen !== manifest.sections.length) fail(`found ${seen} of ${manifest.sections.length} section headings`);
  return questions;
}
