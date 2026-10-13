// The rules of DESIGN.md § 4, run against a data directory (default packages/data).
// `validate` returns the counts, or throws a ValidationError naming the file and id of the first broken rule.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, imageByQuestion, inRanges } from './manifest.mjs';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const OPTION_KEYS = ['A', 'B', 'C'];
const STATUSES = ['draft', 'checked', 'reviewed'];
const MAX_PER_FILE = 51;

/** Throws a ValidationError naming the file. */
function fail(file, message) {
  throw new ValidationError(`${file}: ${message}`);
}

/** Throws a ValidationError naming the file and the question id. */
function failAt(file, id, message) {
  fail(file, `id ${id}: ${message}`);
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sameList = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const visibleFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith('.')).sort() : []);
const textOf = (entry) => [entry.question, ...Object.values(entry.options)].join('\n');

function readJson(dir, rel) {
  let text;
  try {
    text = readFileSync(join(dir, rel), 'utf8');
  } catch (error) {
    fail(rel, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(rel, `is not valid JSON (${error.message})`);
  }
}

/** Items must follow one another from `first` with no gap or overlap; returns the last `to`. */
function tile(items, first, rel, label) {
  let next = first;
  for (const item of items) {
    const name = label(item);
    if (item.from !== next) {
      fail(rel, `${name} range ${item.from}-${item.to} starts at ${item.from}, expected ${next} (gap or overlap)`);
    }
    if (item.to < item.from) fail(rel, `${name} range ${item.from}-${item.to} is backwards`);
    next = item.to + 1;
  }
  return next - 1;
}

/**
 * Section ranges tile 1 to the bank size, chunk ranges tile the same span without crossing a
 * section, topic ranges tile every section. Reads no question file. Returns the bank size.
 */
export function checkManifest(manifest) {
  const rel = 'manifest.json';
  for (const key of ['sections', 'topics', 'chunks', 'images']) {
    if (!Array.isArray(manifest[key])) fail(rel, `${key} is missing or not a list`);
  }
  const sections = new Map();
  for (const s of manifest.sections) {
    if (sections.has(s.slug)) fail(rel, `section ${s.slug} is listed twice`);
    sections.set(s.slug, s);
  }
  const total = tile(manifest.sections, 1, rel, (s) => `section ${s.slug}`);
  if (total < 1) fail(rel, 'has no section');

  const chunkTotal = tile(manifest.chunks, 1, rel, (c) => `chunk ${c.file}`);
  if (chunkTotal !== total) fail(rel, `chunk ranges end at ${chunkTotal}, expected ${total}`);
  for (const c of manifest.chunks) {
    const s = sections.get(c.section);
    if (!s) fail(rel, `chunk ${c.file} names unknown section ${c.section}`);
    if (c.from < s.from || c.to > s.to) {
      fail(rel, `chunk ${c.file} (${c.from}-${c.to}) crosses the edge of section ${s.slug} (${s.from}-${s.to})`);
    }
  }

  for (const t of manifest.topics) {
    if (!sections.has(t.section)) fail(rel, `topic ${t.slug} names unknown section ${t.section}`);
  }
  for (const s of manifest.sections) {
    const ranges = manifest.topics
      .filter((t) => t.section === s.slug)
      .flatMap((t) => t.ranges.map(([from, to]) => ({ from, to, slug: t.slug })))
      .sort((a, b) => a.from - b.from);
    if (ranges.length === 0) fail(rel, `section ${s.slug} has no topic`);
    const last = tile(ranges, s.from, rel, (r) => `topic ${r.slug} in section ${s.slug}`);
    if (last !== s.to) fail(rel, `topic ranges of section ${s.slug} end at ${last}, expected ${s.to}`);
  }
  return total;
}

/** Rule 1: ids once each, per file exactly the chunk's ids, sorted, at most 51 entries. */
function checkIds(dir, manifest, files) {
  const known = new Set(manifest.chunks.map((c) => c.file));
  for (const name of visibleFiles(join(dir, 'questions'))) {
    if (!known.has(name)) fail(`questions/${name}`, 'is not a chunk in the manifest');
  }
  const seen = new Map();
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    const entries = files.get(c.file);
    if (!Array.isArray(entries)) fail(rel, 'does not hold a list of questions');
    if (entries.length > MAX_PER_FILE) fail(rel, `holds ${entries.length} questions, at most ${MAX_PER_FILE}`);
    let previous = 0;
    for (const entry of entries) {
      if (!isObject(entry) || !Number.isInteger(entry.id)) fail(rel, 'has an entry without an integer id');
      if (seen.has(entry.id)) failAt(rel, entry.id, `appears again (first in ${seen.get(entry.id)})`);
      seen.set(entry.id, rel);
      if (entry.id < c.from || entry.id > c.to) failAt(rel, entry.id, `is outside the chunk's ids ${c.from}-${c.to}`);
      if (entry.id < previous) failAt(rel, entry.id, 'is out of order, ids must be sorted');
      previous = entry.id;
    }
    for (let id = c.from; id <= c.to; id++) {
      if (!seen.has(id)) failAt(rel, id, 'is missing from the file');
    }
  }
}

/** Rule 2: the entry's section is its chunk's, and its topic exists and has a range containing the id. */
function checkSectionsAndTopics(manifest, files) {
  const topics = new Map(manifest.topics.map((t) => [t.slug, t]));
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      if (q.section !== c.section) failAt(rel, q.id, `section is "${q.section}", the chunk's section is "${c.section}"`);
      const topic = topics.get(q.topic);
      if (!topic) failAt(rel, q.id, `topic "${q.topic}" is not in the manifest`);
      if (!inRanges(topic.ranges, q.id)) failAt(rel, q.id, `topic "${q.topic}" has no range containing this id`);
    }
  }
}

/** Rule 3: option keys, answer, and clean single-line text. */
function checkText(manifest, files) {
  const headings = manifest.sections.map((s) => s.heading);
  const checkField = (rel, id, field, value) => {
    if (typeof value !== 'string' || value === '') failAt(rel, id, `${field} is not a non-empty string`);
    if (/[\r\n]/.test(value)) failAt(rel, id, `${field} is not a single line`);
    if (value.includes('*')) failAt(rel, id, `${field} contains "*"`);
    if (value.includes('  ')) failAt(rel, id, `${field} contains two consecutive spaces`);
    if (value !== value.trim()) failAt(rel, id, `${field} has leading or trailing whitespace`);
    const heading = headings.find((h) => value.includes(h));
    if (heading) failAt(rel, id, `${field} contains the section heading "${heading}"`);
  };
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      checkField(rel, q.id, 'question', q.question);
      if (!isObject(q.options) || !sameList(Object.keys(q.options).sort(), OPTION_KEYS)) {
        failAt(rel, q.id, `options must have exactly the keys ${OPTION_KEYS.join(', ')}`);
      }
      for (const key of OPTION_KEYS) checkField(rel, q.id, `option ${key}`, q.options[key]);
      if (!OPTION_KEYS.includes(q.answer)) failAt(rel, q.id, `answer "${q.answer}" is not one of ${OPTION_KEYS.join(', ')}`);
    }
  }
}

/** Rule 4: the manifest's images, the `image` fields and the files in images/ agree. */
function checkImages(dir, manifest, files) {
  const imageOf = imageByQuestion(manifest);
  for (const image of manifest.images) {
    if (!existsSync(join(dir, 'images', image.file))) fail(`images/${image.file}`, 'is listed in the manifest but missing');
  }
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      const expected = imageOf.get(q.id);
      if (expected === undefined && q.image !== undefined) failAt(rel, q.id, `has image "${q.image}", the manifest lists none for it`);
      if (expected !== undefined && q.image !== expected) {
        failAt(rel, q.id, `image is ${q.image === undefined ? 'missing' : `"${q.image}"`}, the manifest lists "${expected}"`);
      }
    }
  }
  const listed = new Set(manifest.images.map((i) => i.file));
  for (const name of visibleFiles(join(dir, 'images'))) {
    if (!listed.has(name)) fail(`images/${name}`, 'is not listed in the manifest');
  }
}

function checkTranslation(rel, e, pt) {
  if (!isObject(e.options) || !sameList(Object.keys(e.options).sort(), Object.keys(pt.options).sort())) {
    failAt(rel, e.id, `options must have the keys ${Object.keys(pt.options).join(', ')}`);
  }
}

function checkHint(rel, e, pt) {
  if (!Array.isArray(e.language)) failAt(rel, e.id, 'language is not a list');
  const text = textOf(pt).toLowerCase();
  for (const item of e.language) {
    if (typeof item?.pt !== 'string' || !text.includes(item.pt.toLowerCase())) {
      failAt(rel, e.id, `language text "${item?.pt}" does not occur in the question or its options`);
    }
  }
}

/**
 * Rule 5: translations and hints mirror the question files. Only files that exist are checked.
 * Returns the translations by id, each with the file it came from and its lowercased text, for rule 6.
 */
function checkMirrors(dir, files) {
  const translations = new Map();
  for (const kind of ['translations', 'hints']) {
    const sub = join(kind, 'en');
    for (const name of visibleFiles(join(dir, sub))) {
      const rel = `${sub}/${name}`;
      if (!files.has(name)) fail(rel, 'has no question file of the same name');
      const entries = readJson(dir, rel);
      if (!Array.isArray(entries)) fail(rel, 'does not hold a list');
      const inFile = new Map(files.get(name).map((q) => [q.id, q]));
      const ids = new Set();
      for (const e of entries) {
        if (!isObject(e) || !Number.isInteger(e.id)) fail(rel, 'has an entry without an integer id');
        if (ids.has(e.id)) failAt(rel, e.id, 'appears more than once');
        ids.add(e.id);
        const pt = inFile.get(e.id);
        if (!pt) failAt(rel, e.id, `is not an id of questions/${name}`);
        if (!STATUSES.includes(e.status)) failAt(rel, e.id, `status "${e.status}" is not one of ${STATUSES.join(', ')}`);
        if (kind === 'translations') {
          checkTranslation(rel, e, pt);
          translations.set(e.id, { ...e, file: rel, text: textOf(e).toLowerCase() });
        } else {
          checkHint(rel, e, pt);
        }
      }
      for (const id of inFile.keys()) {
        if (!ids.has(id)) failAt(rel, id, 'is missing, the file must carry the same ids as the question file');
      }
    }
  }
  return translations;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rule 6: glossary/species.json is assumed to be an array of
 * { "pt": string, "scientific": string, "en": string, "group": string }.
 * For each entry whose `pt` occurs (case-insensitive, whole word) in a Portuguese question or its options,
 * the translation's question or options must contain `en` (case-insensitive); draft translations are skipped.
 */
function checkGlossary(dir, files, translations) {
  const rel = 'glossary/species.json';
  if (!existsSync(join(dir, rel))) return;
  const glossary = readJson(dir, rel);
  if (!Array.isArray(glossary)) fail(rel, 'does not hold a list');
  const ptText = new Map([...files.values()].flat().map((q) => [q.id, textOf(q)]));
  for (const entry of glossary) {
    if (!isObject(entry) || typeof entry.pt !== 'string' || typeof entry.en !== 'string') {
      fail(rel, 'has an entry without string "pt" and "en"');
    }
    const word = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(entry.pt)}(?![\\p{L}\\p{N}])`, 'iu');
    const en = entry.en.toLowerCase();
    for (const [id, translation] of translations) {
      if (translation.status === 'draft' || !word.test(ptText.get(id))) continue;
      if (!translation.text.includes(en)) {
        failAt(translation.file, id, `"${entry.pt}" must appear as "${entry.en}" (glossary/species.json)`);
      }
    }
  }
}

/** Checks `dir` (default packages/data) against DESIGN.md § 4, in order, and returns the counts. */
export function validate(dir = dataDir) {
  const manifest = readJson(dir, 'manifest.json');
  checkManifest(manifest);

  const files = new Map(manifest.chunks.map((c) => [c.file, readJson(dir, `questions/${c.file}`)]));
  checkIds(dir, manifest, files);
  checkSectionsAndTopics(manifest, files);
  checkText(manifest, files);
  checkImages(dir, manifest, files);
  checkGlossary(dir, files, checkMirrors(dir, files));

  const all = [...files.values()].flat();
  return {
    questions: all.length,
    files: files.size,
    sections: manifest.sections.length,
    topics: manifest.topics.length,
    images: manifest.images.length,
    imageQuestions: all.filter((q) => q.image !== undefined).length,
  };
}
