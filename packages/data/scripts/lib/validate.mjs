// The rules of DESIGN.md § 4, run against a data directory (default packages/data).
// `validate` returns the counts, or throws a ValidationError naming the file and id of the first broken rule.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, imageByQuestion, inRanges } from './manifest.mjs';
import { clean } from './parse.mjs';

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

export const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sameList = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const visibleFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith('.')).sort() : []);
const textOf = (entry) => [entry.question, ...Object.values(entry.options)].join('\n');

/** Field types a shape check can ask for: the name used in messages and the test. */
const TYPES = {
  string: ['non-empty string', (value) => typeof value === 'string' && value !== ''],
  text: ['string', (value) => typeof value === 'string'],
  integer: ['integer', Number.isInteger],
  list: ['list', Array.isArray],
};

/** Throws unless `value` has the TYPES entry `type`. */
function expectType(rel, id, field, value, type) {
  const [name, test] = TYPES[type];
  if (!test(value)) failAt(rel, id, `${field} is not a ${name}`);
}

/**
 * Every item of `items` is an object whose fields have the types `spec` names ({ field: type }),
 * and its `key` field is unique across the list. `label` names the items in messages.
 */
function checkEntries(rel, label, items, key, spec) {
  const keys = new Set();
  items.forEach((item, i) => {
    if (!isObject(item)) fail(rel, `${label} #${i + 1} is not an object`);
    const name = `${label} ${TYPES.string[1](item[key]) ? item[key] : `#${i + 1}`}`;
    for (const [field, type] of Object.entries(spec)) {
      const [typeName, test] = TYPES[type];
      if (!test(item[field])) fail(rel, `${name} has no ${typeName} "${field}"`);
    }
    if (keys.has(item[key])) fail(rel, `${name} is listed twice`);
    keys.add(item[key]);
  });
}

/** Reads and parses `rel` under `dir`; throws a ValidationError naming the file when it cannot. */
export function readJson(dir, rel) {
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
 * Every entry has the fields of DESIGN.md § 3.4 with their types and a unique slug or file name.
 * Section ranges tile 1 to the bank size, chunk ranges tile the same span without crossing a
 * section, topic ranges tile every section, and every image names existing questions, each
 * under one image only. Reads no question file. Returns the bank size.
 */
export function checkManifest(manifest) {
  const rel = 'manifest.json';
  if (!isObject(manifest)) fail(rel, 'does not hold an object');
  for (const key of ['sections', 'topics', 'chunks', 'images']) {
    if (!Array.isArray(manifest[key])) fail(rel, `${key} is missing or not a list`);
  }
  checkEntries(rel, 'section', manifest.sections, 'slug', { slug: 'string', heading: 'string', pt: 'string', en: 'string', from: 'integer', to: 'integer' });
  checkEntries(rel, 'topic', manifest.topics, 'slug', { slug: 'string', pt: 'string', en: 'string', section: 'string', ranges: 'list' });
  checkEntries(rel, 'chunk', manifest.chunks, 'file', { file: 'string', section: 'string', from: 'integer', to: 'integer' });
  checkEntries(rel, 'image', manifest.images, 'file', { file: 'string', page: 'integer', index: 'integer', questions: 'list' });

  const sections = new Map(manifest.sections.map((s) => [s.slug, s]));
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
    for (const range of t.ranges) {
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger)) {
        fail(rel, `topic ${t.slug} has a range that is not a pair of integers`);
      }
    }
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

  const imageOf = new Map();
  for (const image of manifest.images) {
    if (image.page < 1 || image.index < 1) fail(rel, `image ${image.file} needs a page and index of at least 1`);
    if (image.questions.length === 0) fail(rel, `image ${image.file} names no question`);
    for (const id of image.questions) {
      if (!Number.isInteger(id) || id < 1 || id > total) fail(rel, `image ${image.file} names question ${id}, which is not in 1-${total}`);
      if (imageOf.has(id)) fail(rel, `image ${image.file} names question ${id}, already under ${imageOf.get(id)}`);
      imageOf.set(id, image.file);
    }
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
    expectType(rel, id, field, value, 'string');
    // Single-line, trimmed, single-spaced with plain spaces: the text is a fixed point of the parser's clean().
    if (clean(value) !== value) failAt(rel, id, `${field} is not trimmed and single-spaced on one line with plain spaces`);
    if (value.includes('*')) failAt(rel, id, `${field} contains "*"`);
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

/** A translation entry (DESIGN.md § 3.3): question and options are non-empty strings, notes a string. */
function checkTranslation(rel, e, pt) {
  expectType(rel, e.id, 'question', e.question, 'string');
  if (!isObject(e.options) || !sameList(Object.keys(e.options).sort(), Object.keys(pt.options).sort())) {
    failAt(rel, e.id, `options must have the keys ${Object.keys(pt.options).join(', ')}`);
  }
  for (const [key, value] of Object.entries(e.options)) expectType(rel, e.id, `option ${key}`, value, 'string');
  expectType(rel, e.id, 'notes', e.notes, 'text');
}

/** A hint entry (DESIGN.md § 3.3): language entries whose pt occurs in the question, a nudge, pattern tags. */
function checkHint(rel, e, pt) {
  expectType(rel, e.id, 'language', e.language, 'list');
  const text = textOf(pt).toLowerCase();
  e.language.forEach((item, i) => {
    const field = `language entry ${i + 1}`;
    if (!isObject(item)) failAt(rel, e.id, `${field} is not an object`);
    expectType(rel, e.id, `${field} pt`, item.pt, 'string');
    expectType(rel, e.id, `${field} en`, item.en, 'string');
    expectType(rel, e.id, `${field} note`, item.note, 'text');
    if (!text.includes(item.pt.toLowerCase())) {
      failAt(rel, e.id, `language text "${item.pt}" does not occur in the question or its options`);
    }
  });
  expectType(rel, e.id, 'nudge', e.nudge, 'text');
  expectType(rel, e.id, 'patterns', e.patterns, 'list');
  for (const pattern of e.patterns) expectType(rel, e.id, 'patterns entry', pattern, 'string');
}

/**
 * Rule 5: translations and hints mirror the question files, with the fields of DESIGN.md § 3.3.
 * Only files that exist are checked.
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

/** Curly apostrophes and quotes become straight ones, so a glossary name matches the bank's typography. */
const straighten = (text) => text.replace(/\u2019/g, "'").replace(/[\u201c\u201d]/g, '"');

/**
 * Reads the glossary file `rel` when it exists: a list of objects whose fields have the types `spec`
 * names, with `pt` unique. Returns the list, or undefined when there is no such file.
 */
function readGlossary(dir, rel, label, spec) {
  if (!existsSync(join(dir, rel))) return undefined;
  const glossary = readJson(dir, rel);
  if (!Array.isArray(glossary)) fail(rel, 'does not hold a list');
  checkEntries(rel, label, glossary, 'pt', spec);
  return glossary;
}

/**
 * Rule 6 (DESIGN.md § 4): a glossary `pt` that occurs as a whole word in a question (a hyphen is part
 * of the word, curly quotes straightened) must have its `en` in every non-draft translation of it.
 * Returns the number of glossary entries, 0 when there is no glossary.
 */
function checkGlossary(dir, files, translations) {
  const rel = 'glossary/species.json';
  const glossary = readGlossary(dir, rel, 'species', { pt: 'string', scientific: 'string', en: 'string', group: 'string' });
  if (!glossary) return 0;
  const ptText = new Map([...files.values()].flat().map((q) => [q.id, straighten(textOf(q))]));
  for (const entry of glossary) {
    const word = new RegExp(`(?<![\\p{L}\\p{N}-])${escapeRegExp(straighten(entry.pt))}(?![\\p{L}\\p{N}-])`, 'iu');
    const en = entry.en.toLowerCase();
    for (const [id, translation] of translations) {
      if (translation.status === 'draft' || !word.test(ptText.get(id))) continue;
      if (!translation.text.includes(en)) {
        failAt(translation.file, id, `"${entry.pt}" must appear as "${entry.en}" (glossary/species.json)`);
      }
    }
  }
  return glossary.length;
}

/**
 * Rule 7 (DESIGN.md § 4): glossary/terms.json, when it exists, is a list of { pt, en, note } with
 * `pt` and `en` non-empty, `note` a string and `pt` unique. Only its shape is checked: the use of a
 * term in translations is the meaning pass's job, not a rule's. Returns the number of terms, 0 when
 * there is no terms file.
 */
function checkTerms(dir) {
  return readGlossary(dir, 'glossary/terms.json', 'term', { pt: 'string', en: 'string', note: 'text' })?.length ?? 0;
}

/** The translation counts `validate` reports: entries, files, and entries at each status. */
function countTranslations(translations) {
  const entries = [...translations.values()];
  const counts = { entries: entries.length, files: new Set(entries.map((t) => t.file)).size };
  for (const status of STATUSES) counts[status] = entries.filter((t) => t.status === status).length;
  return counts;
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
  const translations = checkMirrors(dir, files);
  const species = checkGlossary(dir, files, translations);
  const terms = checkTerms(dir);

  const all = [...files.values()].flat();
  return {
    questions: all.length,
    files: files.size,
    sections: manifest.sections.length,
    topics: manifest.topics.length,
    images: manifest.images.length,
    imageQuestions: all.filter((q) => q.image !== undefined).length,
    translations: countTranslations(translations),
    glossaries: { species, terms },
  };
}
