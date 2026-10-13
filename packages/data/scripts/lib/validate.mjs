// The rules of DESIGN.md § 4, run against a data directory (default packages/data).
// `validate` returns the counts, or throws a ValidationError naming the file and id of the first broken rule.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, readManifest } from './manifest.mjs';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const OPTION_KEYS = ['A', 'B', 'C'];
const STATUSES = ['draft', 'checked', 'reviewed'];
const MAX_PER_FILE = 51;

/** Throws a ValidationError that names the file, and the question id when there is one. */
function fail(file, id, message) {
  throw new ValidationError(id === undefined ? `${file}: ${message}` : `${file}: id ${id}: ${message}`);
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sameList = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const visibleFiles = (dir) => readdirSync(dir).filter((name) => !name.startsWith('.')).sort();

function readJson(dir, rel) {
  let text;
  try {
    text = readFileSync(join(dir, rel), 'utf8');
  } catch (error) {
    fail(rel, undefined, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(rel, undefined, `is not valid JSON (${error.message})`);
  }
}

/** Items must follow one another from `first` with no gap or overlap; returns the last `to`. `label` names an item in messages. */
function tile(items, first, rel, label) {
  let next = first;
  for (const item of items) {
    const name = label(item);
    if (item.from !== next) {
      fail(rel, undefined, `${name} range ${item.from}-${item.to} starts at ${item.from}, expected ${next} (gap or overlap)`);
    }
    if (item.to < item.from) fail(rel, undefined, `${name} range ${item.from}-${item.to} is backwards`);
    next = item.to + 1;
  }
  return next - 1;
}

/** Section, chunk and topic ranges tile 1 to `total`; nothing reads a question file yet. */
function checkManifest(manifest, total) {
  const rel = 'manifest.json';
  for (const key of ['sections', 'topics', 'chunks', 'images']) {
    if (!Array.isArray(manifest[key])) fail(rel, undefined, `${key} is missing or not a list`);
  }
  const sections = new Map();
  for (const s of manifest.sections) {
    if (sections.has(s.slug)) fail(rel, undefined, `section ${s.slug} is listed twice`);
    sections.set(s.slug, s);
  }
  const last = tile(manifest.sections, 1, rel, (s) => `section ${s.slug}`);
  if (last !== total) fail(rel, undefined, `section ranges end at ${last}, expected ${total}`);

  const chunkTotal = tile(manifest.chunks, 1, rel, (c) => `chunk ${c.file}`);
  if (chunkTotal !== total) fail(rel, undefined, `chunk ranges end at ${chunkTotal}, expected ${total}`);
  for (const c of manifest.chunks) {
    const s = sections.get(c.section);
    if (!s) fail(rel, undefined, `chunk ${c.file} names unknown section ${c.section}`);
    if (c.from < s.from || c.to > s.to) {
      fail(rel, undefined, `chunk ${c.file} (${c.from}-${c.to}) crosses the edge of section ${s.slug} (${s.from}-${s.to})`);
    }
  }

  for (const t of manifest.topics) {
    if (!sections.has(t.section)) fail(rel, undefined, `topic ${t.slug} names unknown section ${t.section}`);
  }
  for (const s of manifest.sections) {
    const ranges = manifest.topics
      .filter((t) => t.section === s.slug)
      .flatMap((t) => t.ranges.map(([from, to]) => ({ from, to, slug: t.slug })))
      .sort((a, b) => a.from - b.from);
    const first = ranges[0];
    if (!first) fail(rel, undefined, `section ${s.slug} has no topic`);
    if (first.from !== s.from) fail(rel, undefined, `topic ranges of section ${s.slug} start at ${first.from}, expected ${s.from}`);
    let next = s.from;
    for (const r of ranges) {
      if (r.from !== next) {
        fail(rel, undefined, `topic ${r.slug} range ${r.from}-${r.to} in section ${s.slug} starts at ${r.from}, expected ${next} (gap or overlap)`);
      }
      next = r.to + 1;
    }
    if (next - 1 !== s.to) fail(rel, undefined, `topic ranges of section ${s.slug} end at ${next - 1}, expected ${s.to}`);
  }
}

/** Rule 1: ids once each, per file exactly the chunk's ids, sorted, at most 51 entries. */
function checkIds(dir, manifest, files) {
  const known = new Set(manifest.chunks.map((c) => c.file));
  for (const name of existsSync(join(dir, 'questions')) ? visibleFiles(join(dir, 'questions')) : []) {
    if (!known.has(name)) fail(`questions/${name}`, undefined, 'is not a chunk in the manifest');
  }
  const seen = new Map();
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    const entries = files.get(c.file);
    if (!Array.isArray(entries)) fail(rel, undefined, 'does not hold a list of questions');
    if (entries.length > MAX_PER_FILE) fail(rel, undefined, `holds ${entries.length} questions, at most ${MAX_PER_FILE}`);
    let previous = 0;
    for (const entry of entries) {
      if (!isObject(entry) || !Number.isInteger(entry.id)) fail(rel, undefined, 'has an entry without an integer id');
      if (seen.has(entry.id)) fail(rel, entry.id, `appears again (first in ${seen.get(entry.id)})`);
      seen.set(entry.id, rel);
      if (entry.id < c.from || entry.id > c.to) fail(rel, entry.id, `is outside the chunk's ids ${c.from}-${c.to}`);
      if (entry.id < previous) fail(rel, entry.id, 'is out of order, ids must be sorted');
      previous = entry.id;
    }
    for (let id = c.from; id <= c.to; id++) {
      if (!entries.some((e) => e.id === id)) fail(rel, id, 'is missing from the file');
    }
  }
}

/** Rule 2: the entry's section is its chunk's, and its topic exists and has a range containing the id. */
function checkSectionsAndTopics(manifest, files) {
  const topics = new Map(manifest.topics.map((t) => [t.slug, t]));
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      if (q.section !== c.section) fail(rel, q.id, `section is "${q.section}", the chunk's section is "${c.section}"`);
      const topic = topics.get(q.topic);
      if (!topic) fail(rel, q.id, `topic "${q.topic}" is not in the manifest`);
      if (!topic.ranges.some(([from, to]) => q.id >= from && q.id <= to)) {
        fail(rel, q.id, `topic "${q.topic}" has no range containing this id`);
      }
    }
  }
}

/** Rule 3: option keys, answer, and clean single-line text. */
function checkText(manifest, files) {
  const headings = manifest.sections.map((s) => s.heading);
  const checkField = (rel, id, field, value) => {
    if (typeof value !== 'string' || value === '') fail(rel, id, `${field} is not a non-empty string`);
    if (/[\r\n]/.test(value)) fail(rel, id, `${field} is not a single line`);
    if (value.includes('*')) fail(rel, id, `${field} contains "*"`);
    if (value.includes('  ')) fail(rel, id, `${field} contains two consecutive spaces`);
    if (value !== value.trim()) fail(rel, id, `${field} has leading or trailing whitespace`);
    const heading = headings.find((h) => value.includes(h));
    if (heading) fail(rel, id, `${field} contains the section heading "${heading}"`);
  };
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      checkField(rel, q.id, 'question', q.question);
      if (!isObject(q.options) || !sameList(Object.keys(q.options).sort(), OPTION_KEYS)) {
        fail(rel, q.id, `options must have exactly the keys ${OPTION_KEYS.join(', ')}`);
      }
      for (const key of OPTION_KEYS) checkField(rel, q.id, `option ${key}`, q.options[key]);
      if (!OPTION_KEYS.includes(q.answer)) fail(rel, q.id, `answer "${q.answer}" is not one of ${OPTION_KEYS.join(', ')}`);
    }
  }
}

/** Rule 4: the manifest's images, the `image` fields and the files in images/ agree. */
function checkImages(dir, manifest, files) {
  const imageOf = new Map();
  for (const image of manifest.images) {
    for (const id of image.questions) imageOf.set(id, image.file);
    if (!existsSync(join(dir, 'images', image.file))) fail(`images/${image.file}`, undefined, 'is listed in the manifest but missing');
  }
  for (const c of manifest.chunks) {
    const rel = `questions/${c.file}`;
    for (const q of files.get(c.file)) {
      const expected = imageOf.get(q.id);
      if (expected === undefined && q.image !== undefined) fail(rel, q.id, `has image "${q.image}", the manifest lists none for it`);
      if (expected !== undefined && q.image !== expected) {
        fail(rel, q.id, `image is ${q.image === undefined ? 'missing' : `"${q.image}"`}, the manifest lists "${expected}"`);
      }
    }
  }
  const listed = new Set(manifest.images.map((i) => i.file));
  for (const name of existsSync(join(dir, 'images')) ? visibleFiles(join(dir, 'images')) : []) {
    if (!listed.has(name)) fail(`images/${name}`, undefined, 'is not listed in the manifest');
  }
}

/** Rule 5: translations and hints mirror the question files. Only files that exist are checked. */
function checkMirrors(dir, files) {
  const ptById = new Map([...files.values()].flat().map((q) => [q.id, q]));
  const translations = new Map();
  for (const kind of ['translations', 'hints']) {
    const sub = join(kind, 'en');
    if (!existsSync(join(dir, sub))) continue;
    for (const name of visibleFiles(join(dir, sub))) {
      const rel = `${sub}/${name}`;
      if (!files.has(name)) fail(rel, undefined, 'has no question file of the same name');
      const entries = readJson(dir, rel);
      if (!Array.isArray(entries)) fail(rel, undefined, 'does not hold a list');
      const ids = new Set();
      for (const e of entries) {
        if (!isObject(e) || !Number.isInteger(e.id)) fail(rel, undefined, 'has an entry without an integer id');
        if (ids.has(e.id)) fail(rel, e.id, 'appears more than once');
        ids.add(e.id);
        const pt = files.get(name).find((q) => q.id === e.id);
        if (!pt) fail(rel, e.id, `is not an id of questions/${name}`);
        if (!STATUSES.includes(e.status)) fail(rel, e.id, `status "${e.status}" is not one of ${STATUSES.join(', ')}`);
        if (kind === 'translations') {
          if (!isObject(e.options) || !sameList(Object.keys(e.options).sort(), Object.keys(pt.options).sort())) {
            fail(rel, e.id, `options must have the keys ${Object.keys(pt.options).join(', ')}`);
          }
          translations.set(e.id, { ...e, file: rel });
        } else {
          if (!Array.isArray(e.language)) fail(rel, e.id, 'language is not a list');
          const text = [pt.question, ...Object.values(pt.options)].join('\n').toLowerCase();
          for (const item of e.language) {
            if (typeof item?.pt !== 'string' || !text.includes(item.pt.toLowerCase())) {
              fail(rel, e.id, `language text "${item?.pt}" does not occur in the question or its options`);
            }
          }
        }
      }
      for (const { id } of files.get(name)) {
        if (!ids.has(id)) fail(rel, id, 'is missing, the file must carry the same ids as the question file');
      }
    }
  }
  return { ptById, translations };
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rule 6: glossary/species.json is assumed to be an array of
 * { "pt": string, "scientific": string, "en": string, "group": string }.
 * For each entry whose `pt` occurs (case-insensitive, whole word) in a Portuguese question or its options,
 * the translation's question or options must contain `en` (case-insensitive); draft translations are skipped.
 */
function checkGlossary(dir, { ptById, translations }) {
  const rel = 'glossary/species.json';
  if (!existsSync(join(dir, rel))) return;
  const glossary = readJson(dir, rel);
  if (!Array.isArray(glossary)) fail(rel, undefined, 'does not hold a list');
  for (const entry of glossary) {
    if (!isObject(entry) || typeof entry.pt !== 'string' || typeof entry.en !== 'string') {
      fail(rel, undefined, 'has an entry without string "pt" and "en"');
    }
    const word = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(entry.pt)}(?![\\p{L}\\p{N}])`, 'iu');
    const en = entry.en.toLowerCase();
    for (const [id, translation] of translations) {
      if (translation.status === 'draft') continue;
      const pt = ptById.get(id);
      if (!word.test([pt.question, ...Object.values(pt.options)].join('\n'))) continue;
      const text = [translation.question, ...Object.values(translation.options)].join('\n').toLowerCase();
      if (!text.includes(en)) {
        fail(translation.file, id, `"${entry.pt}" must appear as "${entry.en}" (glossary/species.json)`);
      }
    }
  }
}

/**
 * Checks `dir` (default packages/data) against DESIGN.md § 4, in order, and returns the counts.
 * `questionCount` is the size of the bank the ranges must tile (506 for the real data).
 */
export function validate(dir = dataDir, { questionCount = 506 } = {}) {
  let manifest;
  try {
    manifest = readManifest(dir);
  } catch (error) {
    fail('manifest.json', undefined, `cannot be read (${error.message})`);
  }
  checkManifest(manifest, questionCount);

  const files = new Map(manifest.chunks.map((c) => [c.file, readJson(dir, `questions/${c.file}`)]));
  checkIds(dir, manifest, files);
  checkSectionsAndTopics(manifest, files);
  checkText(manifest, files);
  checkImages(dir, manifest, files);
  checkGlossary(dir, checkMirrors(dir, files));

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
