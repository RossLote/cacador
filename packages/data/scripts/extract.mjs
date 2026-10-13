// PDF to questions/ and images/ (DESIGN.md § 2, § 3.3). Deterministic; driven by manifest.json.
// Needs pdftotext and pdfimages (poppler) on PATH.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataDir, imageByQuestion, topicOfId } from './lib/manifest.mjs';
import { checkText, clean, ExtractError, fail, LETTERS, parseQuestions, toLines } from './lib/parse.mjs';
import { checkManifest, isObject, readJson, validate, ValidationError } from './lib/validate.mjs';

// Hand fixes live here so a rerun reproduces them: { [id]: { question?, options?: { A?, B?, C? } } }.
// The PDF wins; add an entry only when its text is wrong and say why. Empty: no fix is needed.
const CORRECTIONS = {};

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
const pdfLines = (pdf) => toLines(run('pdftotext', ['-layout', pdf, '-']));

/** Fails loudly on a CORRECTIONS key, field or option key that would otherwise never apply. */
function checkCorrections(total) {
  for (const [key, fix] of Object.entries(CORRECTIONS)) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) > total) fail(`correction key "${key}" is not a question id from 1 to ${total}`);
    if (!isObject(fix)) fail(`correction ${key}: must be an object`);
    for (const field of Object.keys(fix)) {
      if (field !== 'question' && field !== 'options') fail(`correction ${key}: unknown field "${field}" (question or options)`);
    }
    if (fix.options !== undefined && !isObject(fix.options)) fail(`correction ${key}: options must be an object`);
    for (const letter of Object.keys(fix.options ?? {})) {
      if (!LETTERS.includes(letter)) fail(`correction ${key}: option key "${letter}" is not one of ${LETTERS.join(', ')}`);
    }
  }
}

/** A corrected text is cleaned and checked like parsed text; an uncorrected one passes through (already clean). */
function corrected(id, what, fixed, parsed) {
  if (fixed === undefined) return parsed;
  if (typeof fixed !== 'string') fail(`correction ${id}: ${what} must be a string`);
  const text = clean(fixed);
  checkText(`correction ${id} ${what}`, text);
  return text;
}

/** Entries in the § 3.3 shape; checkManifest has already confirmed every image names an existing question. */
function toEntries(questions, manifest) {
  const images = imageByQuestion(manifest);
  checkCorrections(questions.length);
  return questions.map((q) => {
    const fix = CORRECTIONS[q.id] ?? {};
    const options = Object.fromEntries(LETTERS.map((letter, i) => [letter, corrected(q.id, `option ${letter}`, fix.options?.[letter], q.options[i])]));
    const image = images.get(q.id);
    if (image && !/figura|sinal/i.test(q.stem)) fail(`question ${q.id}: has image ${image} but its stem does not mention a figure or sign`);
    return {
      id: q.id,
      section: q.section.slug,
      topic: topicOfId(manifest, q.id).slug,
      ...(image ? { image } : {}),
      question: corrected(q.id, 'question', fix.question, q.stem),
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
    validate(dataDir); // the written files pass every rule of DESIGN.md § 4, or extract fails here
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
