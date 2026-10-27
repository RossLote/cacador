// Typed loader for the question bank (DESIGN.md § 3). JSON is imported statically so
// Vite and vitest resolve it without runtime file reading; nothing here edits data.
import manifestJson from '../manifest.json' with { type: 'json' };
import chunk01 from '../questions/01-documentos.json' with { type: 'json' };
import chunk02 from '../questions/02-conceitos-basicos.json' with { type: 'json' };
import chunk03 from '../questions/03-biologia-coelho-lebre.json' with { type: 'json' };
import chunk04 from '../questions/04-biologia-raposa-javali.json' with { type: 'json' };
import chunk05 from '../questions/05-biologia-veado-corco.json' with { type: 'json' };
import chunk06 from '../questions/06-biologia-perdiz.json' with { type: 'json' };
import chunk07 from '../questions/07-biologia-pombos-codorniz.json' with { type: 'json' };
import chunk08 from '../questions/08-biologia-patos.json' with { type: 'json' };
import chunk09 from '../questions/09-biologia-pombos-galinhola-narcejas.json' with { type: 'json' };
import chunk10 from '../questions/10-biologia-tarambola-tordos.json' with { type: 'json' };
import chunk11 from '../questions/11-nao-cinegeticas.json' with { type: 'json' };
import chunk12 from '../questions/12-condicionamentos.json' with { type: 'json' };
import chunk13 from '../questions/13-terrenos.json' with { type: 'json' };
import chunk14 from '../questions/14-periodos-processos.json' with { type: 'json' };
import chunk15 from '../questions/15-arco-besta.json' with { type: 'json' };
import chunk16 from '../questions/16-campos-treino.json' with { type: 'json' };
import chunk17 from '../questions/17-caes.json' with { type: 'json' };
import chunk18 from '../questions/18-cetraria.json' with { type: 'json' };
import translation01 from '../translations/en/01-documentos.json' with { type: 'json' };
import translation02 from '../translations/en/02-conceitos-basicos.json' with { type: 'json' };
import translation03 from '../translations/en/03-biologia-coelho-lebre.json' with { type: 'json' };
import translation04 from '../translations/en/04-biologia-raposa-javali.json' with { type: 'json' };
import translation05 from '../translations/en/05-biologia-veado-corco.json' with { type: 'json' };
import translation06 from '../translations/en/06-biologia-perdiz.json' with { type: 'json' };
import translation07 from '../translations/en/07-biologia-pombos-codorniz.json' with { type: 'json' };
import translation08 from '../translations/en/08-biologia-patos.json' with { type: 'json' };
import translation09 from '../translations/en/09-biologia-pombos-galinhola-narcejas.json' with { type: 'json' };
import translation10 from '../translations/en/10-biologia-tarambola-tordos.json' with { type: 'json' };
import translation11 from '../translations/en/11-nao-cinegeticas.json' with { type: 'json' };
import translation12 from '../translations/en/12-condicionamentos.json' with { type: 'json' };
import translation13 from '../translations/en/13-terrenos.json' with { type: 'json' };
import translation14 from '../translations/en/14-periodos-processos.json' with { type: 'json' };
import translation15 from '../translations/en/15-arco-besta.json' with { type: 'json' };
import translation16 from '../translations/en/16-campos-treino.json' with { type: 'json' };
import translation17 from '../translations/en/17-caes.json' with { type: 'json' };
import translation18 from '../translations/en/18-cetraria.json' with { type: 'json' };
import hint01 from '../hints/en/01-documentos.json' with { type: 'json' };
import hint02 from '../hints/en/02-conceitos-basicos.json' with { type: 'json' };
import hint03 from '../hints/en/03-biologia-coelho-lebre.json' with { type: 'json' };
import hint04 from '../hints/en/04-biologia-raposa-javali.json' with { type: 'json' };
import hint05 from '../hints/en/05-biologia-veado-corco.json' with { type: 'json' };
import hint06 from '../hints/en/06-biologia-perdiz.json' with { type: 'json' };
import hint07 from '../hints/en/07-biologia-pombos-codorniz.json' with { type: 'json' };
import hint08 from '../hints/en/08-biologia-patos.json' with { type: 'json' };
import hint09 from '../hints/en/09-biologia-pombos-galinhola-narcejas.json' with { type: 'json' };
import hint10 from '../hints/en/10-biologia-tarambola-tordos.json' with { type: 'json' };
import hint11 from '../hints/en/11-nao-cinegeticas.json' with { type: 'json' };
import hint12 from '../hints/en/12-condicionamentos.json' with { type: 'json' };
import hint13 from '../hints/en/13-terrenos.json' with { type: 'json' };
import hint14 from '../hints/en/14-periodos-processos.json' with { type: 'json' };
import hint15 from '../hints/en/15-arco-besta.json' with { type: 'json' };
import hint16 from '../hints/en/16-campos-treino.json' with { type: 'json' };
import hint17 from '../hints/en/17-caes.json' with { type: 'json' };
import hint18 from '../hints/en/18-cetraria.json' with { type: 'json' };
import patternsJson from '../hints/patterns.json' with { type: 'json' };
import wordsAnatomy from '../words/anatomy.json' with { type: 'json' };
import wordsDog from '../words/dog.json' with { type: 'json' };
import wordsFalconry from '../words/falconry.json' with { type: 'json' };
import wordsGeneral from '../words/general.json' with { type: 'json' };
import wordsGround from '../words/ground.json' with { type: 'json' };
import wordsHabitat from '../words/habitat.json' with { type: 'json' };
import wordsLaw from '../words/law.json' with { type: 'json' };
import wordsLife from '../words/life.json' with { type: 'json' };
import wordsMethod from '../words/method.json' with { type: 'json' };
import wordsSpecies from '../words/species.json' with { type: 'json' };
import wordsTime from '../words/time.json' with { type: 'json' };
import wordsWeapon from '../words/weapon.json' with { type: 'json' };
import { WORD_KINDS, findPhrase } from '../scripts/lib/words.mjs';

export type OptionKey = 'A' | 'B' | 'C';

export interface Section {
  slug: string;
  pt: string;
  en: string;
  /** The all-caps heading exactly as the PDF prints it. */
  heading: string;
  from: number;
  to: number;
}

export interface Topic {
  slug: string;
  pt: string;
  en: string;
  section: string;
  ranges: [number, number][];
}

export interface Chunk {
  file: string;
  section: string;
  from: number;
  to: number;
}

export interface ImageEntry {
  file: string;
  page: number;
  /** 1-based placement order on the page. */
  index: number;
  questions: number[];
}

export interface Manifest {
  sections: Section[];
  topics: Topic[];
  chunks: Chunk[];
  images: ImageEntry[];
}

export type Status = 'draft' | 'checked' | 'reviewed';

/** A Portuguese question, one entry in a questions/ file (DESIGN.md § 3.3). */
export interface Question {
  id: number;
  section: string;
  topic: string;
  /** Present only on the questions the manifest lists under images. */
  image?: string;
  question: string;
  options: Record<OptionKey, string>;
  answer: OptionKey;
}

/** An English translation, one entry in a translations/en/ file (DESIGN.md § 3.3). */
export interface Translation {
  id: number;
  question: string;
  options: Record<OptionKey, string>;
  status: Status;
  notes: string;
}

export interface HintLanguage {
  pt: string;
  en: string;
  note: string;
}

/** A pattern, one entry in hints/patterns.json (DESIGN.md § 3.3): a tag a hint's `patterns` may carry. */
export interface Pattern {
  /** The kebab-case tag, unique in the list. */
  slug: string;
  /** The construction as the bank prints it, or a short Portuguese label. */
  pt: string;
  /** The English name the app's report shows. */
  en: string;
  /** What the construction does to the reading and when to tag it. */
  note: string;
}

/** A hint, one entry in a hints/en/ file (DESIGN.md § 3.3). */
export interface Hint {
  id: number;
  language: HintLanguage[];
  nudge: string;
  patterns: string[];
  status: Status;
}

export const manifest: Manifest = manifestJson as Manifest;

/** The closed list of pattern tags (DESIGN.md § 4 rule 8 checks every hint's tags against it). */
export const patterns: readonly Pattern[] = patternsJson;

/** One import per manifest chunk, in manifest order; the JSON widens `answer` to string, so it is narrowed to Question once, here. */
const chunks = [
  chunk01, chunk02, chunk03, chunk04, chunk05, chunk06, chunk07, chunk08, chunk09,
  chunk10, chunk11, chunk12, chunk13, chunk14, chunk15, chunk16, chunk17, chunk18,
];

/** All 506 questions in id order (the validator guarantees each file is sorted and the chunks tile the ids). */
export const questions: readonly Question[] = chunks.flat() as Question[];

export const sections: readonly Section[] = manifest.sections;
export const topics: readonly Topic[] = manifest.topics;

const byId = new Map(questions.map((q) => [q.id, q]));
const sectionBySlug = new Map(sections.map((s) => [s.slug, s]));
const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

export const questionById = (id: number): Question | undefined => byId.get(id);

const bySection = Map.groupBy(questions, (q) => q.section);
const byTopic = Map.groupBy(questions, (q) => q.topic);

export const questionsInSection = (slug: string): readonly Question[] => bySection.get(slug) ?? [];

export const questionsInTopic = (slug: string): readonly Question[] => byTopic.get(slug) ?? [];

export const sectionOf = (question: Question): Section | undefined => sectionBySlug.get(question.section);

export const topicOf = (question: Question): Topic | undefined => topicBySlug.get(question.topic);

/**
 * One import per translations/en/ file, listed in chunk order like `chunks` (the loader test fails
 * when a file on disk is not wired in); the JSON widens `status` to string, so the list is narrowed
 * once, here. hints/en/ is wired into `hints` the same way. import.meta.glob was not used
 * because tsc needs Vite client type shims for it, and the files are few and named.
 */
const translations = [
  translation01, translation02, translation03, translation04, translation05, translation06,
  translation07, translation08, translation09, translation10, translation11, translation12,
  translation13, translation14, translation15, translation16, translation17, translation18,
].flat() as Translation[];
const hints = [
  hint01, hint02, hint03, hint04, hint05, hint06, hint07, hint08, hint09,
  hint10, hint11, hint12, hint13, hint14, hint15, hint16, hint17, hint18,
].flat() as Hint[];

const translationById = new Map(translations.map((t) => [t.id, t]));
const hintById = new Map(hints.map((h) => [h.id, h]));

/** The English translation for an id, or undefined while no file holds it. */
export const translationFor = (id: number): Translation | undefined => translationById.get(id);

/** The hint for an id, or undefined while no file holds it. */
export const hintFor = (id: number): Hint | undefined => hintById.get(id);

/** The twelve kinds of term the words drill draws from (DESIGN.md § 3.3), each a file words/<kind>.json. */
export type WordKind = (typeof WORD_KINDS)[number];

/** A word, one entry in a words/ file (DESIGN.md § 3.3). */
export interface Word {
  /** The dictionary headword, or a set phrase; unique across the twelve files. */
  pt: string;
  /** A short run of words verbatim from one of the named questions (findPhrase compares it). */
  phrase: string;
  /** The English the translation uses for the word. */
  en: string;
  /** The kind of the file the word sits in. */
  kind: WordKind;
  /** Every question that uses the word in this sense, ascending. */
  ids: number[];
  /** Shown only after answering; empty when the word needs none. */
  note: string;
}

/** The validator's phrase match (rule 9), so the app finds and cuts out a word's phrase as the validator checks it. */
export { findPhrase };

/** The twelve kinds in the order `words` lists them. */
export const wordKinds: readonly WordKind[] = WORD_KINDS;

/**
 * One import per words/ file, keyed by its kind (the loader test fails when a file's words are not its
 * file's); the JSON widens `kind` to string, so the list is narrowed to Word once, here.
 */
const wordFiles = {
  anatomy: wordsAnatomy, dog: wordsDog, falconry: wordsFalconry, general: wordsGeneral,
  ground: wordsGround, habitat: wordsHabitat, law: wordsLaw, life: wordsLife,
  method: wordsMethod, species: wordsSpecies, time: wordsTime, weapon: wordsWeapon,
} satisfies Record<WordKind, unknown[]>;

/** Every word of the twelve files, kind by kind in `wordKinds` order, each file in its own order (sorted by pt). */
export const words: readonly Word[] = wordKinds.flatMap((kind) => wordFiles[kind]) as Word[];

/**
 * The first of the word's questions whose stem or an option holds its phrase, compared as findPhrase
 * compares (DESIGN.md § 6.11); the validator's rule 9 guarantees one for every word of `words`.
 */
export const questionForWord = (word: Word): Question | undefined =>
  word.ids
    .map(questionById)
    .find((q) => q !== undefined && [q.question, ...Object.values(q.options)].some((field) => findPhrase(field, word.phrase) !== -1));
