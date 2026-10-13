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

/** A hint, one entry in a hints/en/ file (DESIGN.md § 3.3). */
export interface Hint {
  id: number;
  language: HintLanguage[];
  nudge: string;
  patterns: string[];
  status: Status;
}

export const manifest: Manifest = manifestJson as Manifest;

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
 * PHASE 2 HOOK: every file in translations/en/ is imported by name at the top (same name as
 * its chunk file, one import line each, as for chunks) and listed here in chunk order; a new
 * translation file gets its import line and its place in this list. hints/en/ does not exist
 * yet; its files go into hintFiles the same way when phase 3 lands them. The JSON widens
 * `status` to string, so each list is narrowed once, here. import.meta.glob was not used
 * because tsc needs Vite client type shims for it, and the files are few and named.
 */
const translationFiles = [translation01, translation02, translation03] as (readonly Translation[])[];
const hintFiles: readonly (readonly Hint[])[] = [];

const translationById = new Map(translationFiles.flat().map((t) => [t.id, t]));
const hintById = new Map(hintFiles.flat().map((h) => [h.id, h]));

/** The English translation for an id, or undefined while no file holds it. */
export const translationFor = (id: number): Translation | undefined => translationById.get(id);

/** The hint for an id, or undefined while no file holds it. */
export const hintFor = (id: number): Hint | undefined => hintById.get(id);
