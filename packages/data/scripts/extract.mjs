// PDF to questions/ and images/ (DESIGN.md § 2, § 3.3). Deterministic; driven by manifest.json.
// Needs pdftotext and pdfimages (poppler) on PATH.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataDir, readManifest } from './lib/manifest.mjs';

const EXPECTED_QUESTIONS = 506;
const LETTERS = ['A', 'B', 'C'];

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

function parseQuestions(lines, manifest) {
  const headings = new Map(manifest.sections.map((s) => [s.heading, s]));
  const sectionOrder = manifest.sections.map((s) => s.heading);
  const seenHeadings = [];
  const questions = [];
  let section = null;
  let q = null;
  let nextId = 1;

  const finish = () => {
    if (!q) return;
    const where = `question ${q.id} (page ${q.page})`;
    if (q.options.length !== LETTERS.length) fail(`${where}: expected 3 options, found ${q.options.length}`);
    const marked = q.options.filter((o) => o.marked);
    if (marked.length !== 1) fail(`${where}: expected exactly one option marked *, found ${marked.length}`);
    const entry = { stem: joinPieces(q.stem), options: q.options.map((o) => joinPieces(o.pieces)) };
    for (const text of [entry.stem, ...entry.options]) {
      if (text === '' || text.includes('*')) fail(`${where}: empty text or stray "*" in "${text}"`);
    }
    questions.push({ id: q.id, page: q.page, section: q.section, stem: entry.stem, options: entry.options, answer: marked[0].letter });
    q = null;
  };

  for (const { page, text } of lines) {
    const line = clean(text);
    if (line === '') continue;
    if (headings.has(line)) {
      finish();
      const expected = sectionOrder[seenHeadings.length];
      if (line !== expected) fail(`page ${page}: heading "${line}" found, expected "${expected}"`);
      seenHeadings.push(line);
      section = headings.get(line);
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
    const option = new RegExp(`^${LETTERS[q.options.length] ?? '-'}\\) ?(.*)$`).exec(body);
    if (option) {
      q.options.push({ letter: LETTERS[q.options.length], pieces: option[1] === '' ? [] : [option[1]], marked });
    } else if (q.options.length === 0) {
      if (marked) fail(`question ${q.id} (page ${page}): "*" in the stem`);
      q.stem.push(body);
    } else {
      const current = q.options[q.options.length - 1];
      current.pieces.push(body);
      current.marked ||= marked;
    }
  }
  finish();

  if (questions.length !== EXPECTED_QUESTIONS) {
    const last = questions.at(-1);
    fail(`parsed ${questions.length} questions, expected ${EXPECTED_QUESTIONS} (last parsed: question ${last?.id} on page ${last?.page}, next expected id ${nextId})`);
  }
  if (seenHeadings.length !== sectionOrder.length) {
    fail(`found ${seenHeadings.length} of ${sectionOrder.length} section headings`);
  }
  return questions;
}

function toEntries(questions, manifest) {
  const images = new Map(manifest.images.flatMap((image) => image.questions.map((id) => [id, image.file])));
  for (const id of images.keys()) {
    if (id < 1 || id > EXPECTED_QUESTIONS) fail(`manifest image names question ${id}, which does not exist`);
  }
  const topicOf = (id) => {
    const topic = manifest.topics.find((t) => t.ranges.some(([from, to]) => id >= from && id <= to));
    if (!topic) fail(`question ${id}: no topic covers it in the manifest`);
    return topic.slug;
  };
  for (const id of Object.keys(CORRECTIONS)) {
    if (!questions.some((q) => q.id === Number(id))) fail(`correction table names question ${id}, which does not exist`);
  }
  return questions.map((q) => {
    const fix = CORRECTIONS[q.id] ?? {};
    const options = Object.fromEntries(LETTERS.map((letter, i) => [letter, fix.options?.[letter] ?? q.options[i]]));
    const image = images.get(q.id);
    if (image && !/figura|sinal/i.test(q.stem)) fail(`question ${q.id}: has image ${image} but its stem does not mention a figure or sign`);
    return {
      id: q.id,
      section: q.section.slug,
      topic: topicOf(q.id),
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
  const listing = run('pdfimages', ['-list', pdf]).split('\n').slice(2).filter((l) => l.trim() !== '');
  const byPage = new Map();
  for (const row of listing) {
    const col = row.trim().split(/\s+/);
    const [page, num, type, , , , , , enc] = col;
    if (type !== 'image' || enc !== 'jpeg') fail(`page ${page}: image placement ${num} is ${type}/${enc}, expected a jpeg image`);
    byPage.set(Number(page), [...(byPage.get(Number(page)) ?? []), Number(num)]);
  }
  const dump = join(tmp, 'img');
  mkdirSync(dump);
  run('pdfimages', ['-j', '-p', pdf, join(dump, 'p')]);
  const path = (page, num) => join(dump, `p-${String(page).padStart(3, '0')}-${String(num).padStart(3, '0')}.jpg`);

  const wanted = new Map(); // file -> bytes
  const used = new Set();
  for (const image of manifest.images) {
    const num = byPage.get(image.page)?.[image.index - 1];
    if (num === undefined) fail(`manifest image ${image.file}: page ${image.page} has no placement number ${image.index}`);
    // A picture sits next to its question; a shared one is also named by questions that refer back to it.
    const pages = image.questions.map((id) => questions.find((x) => x.id === id).page);
    if (!pages.some((p) => Math.abs(p - image.page) <= 1)) {
      fail(`manifest image ${image.file}: image on page ${image.page}, but questions ${image.questions.join(', ')} are on pages ${pages.join(', ')}`);
    }
    wanted.set(image.file, readFileSync(path(image.page, num)));
    used.add(`${image.page}/${num}`);
  }
  // An unlisted placement is a repeat of a listed picture (page 38's second sign, page 40); anything else is new.
  for (const [page, nums] of byPage) {
    for (const num of nums.filter((n) => !used.has(`${page}/${n}`))) {
      const bytes = readFileSync(path(page, num));
      if (![...wanted.values()].some((known) => known.equals(bytes))) {
        fail(`page ${page}: image placement ${num} is not in the manifest and repeats no listed picture`);
      }
    }
  }
  return wanted;
}

// Output ---------------------------------------------------------------------------------------

function main() {
  const manifest = readManifest();
  const pdf = join(dataDir, 'source', 'questionario-2016.pdf');
  const tmp = mkdtempSync(join(tmpdir(), 'cacador-extract-'));
  try {
    const parsed = parseQuestions(pdfLines(pdf), manifest);
    const entries = toEntries(parsed, manifest);
    const images = extractImages(pdf, manifest, parsed, tmp);

    const files = manifest.chunks.map((chunk) => {
      const inChunk = entries.filter((e) => e.id >= chunk.from && e.id <= chunk.to);
      if (inChunk.length !== chunk.to - chunk.from + 1) fail(`${chunk.file}: found ${inChunk.length} questions, expected ${chunk.to - chunk.from + 1}`);
      if (inChunk.some((e) => e.section !== chunk.section)) fail(`${chunk.file}: spans a section other than ${chunk.section}`);
      return [chunk.file, `${JSON.stringify(inChunk, null, 2)}\n`];
    });

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
  if (!(error instanceof ExtractError)) throw error;
  console.error(`extract: ${error.message}`);
  process.exit(1);
}
