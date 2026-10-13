// PDF to questions/ and images/ (DESIGN.md § 2, § 3.3). Deterministic; driven by manifest.json.
// Needs pdftotext and pdfimages (poppler) on PATH.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataDir, imageByQuestion, topicOfId } from './lib/manifest.mjs';
import { checkManifest, readJson, ValidationError } from './lib/validate.mjs';

const LETTERS = ['A', 'B', 'C'];
const OPTION_LINE = /^([ABC])\) ?(.*)$/;

// Hand fixes live here so a rerun reproduces them: { [id]: { question?, options?: { A?, B?, C? } } }.
// The PDF wins; add an entry only when its text is wrong and say why. Empty: no fix is needed.
const CORRECTIONS = {};

class ExtractError extends Error {}
const fail = (message) => {
  throw new ExtractError(message);
};

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') fail(`${cmd} not found on PATH (brew install poppler)`);
    throw error;
  }
}

// Text -----------------------------------------------------------------------------------------

/** Lines of the PDF with their 1-based page; -layout keeps the hyphen at a wrapped line end. */
function pdfLines(pdf) {
  const text = run('pdftotext', ['-layout', pdf, '-']);
  return text.split('\f').flatMap((page, i) => page.split('\n').map((text) => ({ page: i + 1, text })));
}

const clean = (s) => s.replace(/\s+/g, ' ').trim();

/** Join wrapped pieces; a piece ending in "-" is a hyphenated word split by the wrap (no space). */
function joinPieces(pieces) {
  return pieces.reduce((acc, piece) => (acc === '' ? piece : acc.endsWith('-') ? acc + piece : `${acc} ${piece}`), '');
}

/** Parses the text into `total` questions with contiguous ids from 1, each under its section. */
function parseQuestions(lines, manifest, total) {
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
    for (const text of [stem, ...options]) {
      if (text === '' || text.includes('*')) fail(`${where}: empty text or stray "*" in "${text}"`);
    }
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

/** Entries in the § 3.3 shape; checkManifest has already confirmed every image names an existing question. */
function toEntries(questions, manifest) {
  const images = imageByQuestion(manifest);
  for (const id of Object.keys(CORRECTIONS)) {
    if (id < 1 || id > questions.length) fail(`correction table names question ${id}, which does not exist`);
  }
  return questions.map((q) => {
    const fix = CORRECTIONS[q.id] ?? {};
    const options = Object.fromEntries(LETTERS.map((letter, i) => [letter, fix.options?.[letter] ?? q.options[i]]));
    const image = images.get(q.id);
    if (image && !/figura|sinal/i.test(q.stem)) fail(`question ${q.id}: has image ${image} but its stem does not mention a figure or sign`);
    return {
      id: q.id,
      section: q.section.slug,
      topic: topicOfId(manifest, q.id).slug,
      ...(image ? { image } : {}),
      question: fix.question ?? q.stem,
      options,
      answer: q.answer,
    };
  });
}

// Images ---------------------------------------------------------------------------------------

/** Dump every JPEG placement and map (page, 1-based index on the page) to the manifest's file names. */
function extractImages(pdf, manifest, questions, tmp) {
  const rows = run('pdfimages', ['-list', pdf])
    .split('\n')
    .slice(2)
    .filter((l) => l.trim() !== '')
    .map((l) => l.trim().split(/\s+/))
    .map((col) => ({ page: Number(col[0]), num: Number(col[1]), type: col[2], enc: col[8] }));
  for (const r of rows) {
    if (r.type !== 'image' || r.enc !== 'jpeg') fail(`page ${r.page}: image placement ${r.num} is ${r.type}/${r.enc}, expected a jpeg image`);
  }
  const byPage = Map.groupBy(rows, (r) => r.page);
  const dump = join(tmp, 'img');
  mkdirSync(dump);
  run('pdfimages', ['-j', '-p', pdf, join(dump, 'p')]);
  const bytesOf = (r) => readFileSync(join(dump, `p-${String(r.page).padStart(3, '0')}-${String(r.num).padStart(3, '0')}.jpg`));

  const wanted = new Map(); // file -> bytes
  const used = new Set();
  for (const image of manifest.images) {
    const row = byPage.get(image.page)?.[image.index - 1];
    if (!row) fail(`manifest image ${image.file}: page ${image.page} has no placement number ${image.index}`);
    // A picture sits next to its question; a shared one is also named by questions that refer back to it.
    const pages = image.questions.map((id) => questions[id - 1].page);
    if (!pages.some((p) => Math.abs(p - image.page) <= 1)) {
      fail(`manifest image ${image.file}: image on page ${image.page}, but questions ${image.questions.join(', ')} are on pages ${pages.join(', ')}`);
    }
    wanted.set(image.file, bytesOf(row));
    used.add(row);
  }
  // An unlisted placement is a repeat of a listed picture (page 38's second sign, page 40); anything else is new.
  const known = [...wanted.values()];
  for (const row of rows.filter((r) => !used.has(r))) {
    const bytes = bytesOf(row);
    if (!known.some((k) => k.equals(bytes))) {
      fail(`page ${row.page}: image placement ${row.num} is not in the manifest and repeats no listed picture`);
    }
  }
  return wanted;
}

// Output ---------------------------------------------------------------------------------------

function main() {
  const manifest = readJson(dataDir, 'manifest.json');
  const total = checkManifest(manifest);
  const pdf = join(dataDir, 'source', 'questionario-2016.pdf');
  const tmp = mkdtempSync(join(tmpdir(), 'cacador-extract-'));
  try {
    const parsed = parseQuestions(pdfLines(pdf), manifest, total);
    const entries = toEntries(parsed, manifest);
    const images = extractImages(pdf, manifest, parsed, tmp);
    // Ids are contiguous from 1 and the chunks tile them, so a chunk is a slice.
    const files = manifest.chunks.map((chunk) => [chunk.file, `${JSON.stringify(entries.slice(chunk.from - 1, chunk.to), null, 2)}\n`]);

    const questionsDir = join(dataDir, 'questions');
    const imagesDir = join(dataDir, 'images');
    rmSync(questionsDir, { recursive: true, force: true });
    rmSync(imagesDir, { recursive: true, force: true });
    mkdirSync(questionsDir);
    mkdirSync(imagesDir);
    for (const [file, text] of files) writeFileSync(join(questionsDir, file), text);
    for (const [file, bytes] of images) writeFileSync(join(imagesDir, file), bytes);
    console.log(`extract: ${entries.length} questions in ${files.length} files, ${images.size} images`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  if (!(error instanceof ExtractError || error instanceof ValidationError)) throw error;
  console.error(`extract: ${error.message}`);
  process.exit(1);
}
