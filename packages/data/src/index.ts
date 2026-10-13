// Typed loader for the question bank (DESIGN.md § 3). JSON is imported statically so
// Vite and vitest resolve it without runtime file reading; nothing here edits data.
import manifestJson from '../manifest.json';
import chunk01 from '../questions/01-documentos.json';
import chunk02 from '../questions/02-conceitos-basicos.json';
import chunk03 from '../questions/03-biologia-coelho-lebre.json';
import chunk04 from '../questions/04-biologia-raposa-javali.json';
import chunk05 from '../questions/05-biologia-veado-corco.json';
import chunk06 from '../questions/06-biologia-perdiz.json';
import chunk07 from '../questions/07-biologia-pombos-codorniz.json';
import chunk08 from '../questions/08-biologia-patos.json';
import chunk09 from '../questions/09-biologia-pombos-galinhola-narcejas.json';
import chunk10 from '../questions/10-biologia-tarambola-tordos.json';
import chunk11 from '../questions/11-nao-cinegeticas.json';
import chunk12 from '../questions/12-condicionamentos.json';
import chunk13 from '../questions/13-terrenos.json';
import chunk14 from '../questions/14-periodos-processos.json';
import chunk15 from '../questions/15-arco-besta.json';
import chunk16 from '../questions/16-campos-treino.json';
import chunk17 from '../questions/17-caes.json';
import chunk18 from '../questions/18-cetraria.json';

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

/**
 * The chunk files, by name. One import per manifest chunk; loader.test.ts asserts the
 * keys equal manifest.chunks.map(c => c.file), so the two cannot drift. JSON imports
 * widen `answer` to string, so each file is narrowed to Question[] once, here.
 */
const chunkModules: Record<string, readonly unknown[]> = {
  '01-documentos.json': chunk01,
  '02-conceitos-basicos.json': chunk02,
  '03-biologia-coelho-lebre.json': chunk03,
  '04-biologia-raposa-javali.json': chunk04,
  '05-biologia-veado-corco.json': chunk05,
  '06-biologia-perdiz.json': chunk06,
  '07-biologia-pombos-codorniz.json': chunk07,
  '08-biologia-patos.json': chunk08,
  '09-biologia-pombos-galinhola-narcejas.json': chunk09,
  '10-biologia-tarambola-tordos.json': chunk10,
  '11-nao-cinegeticas.json': chunk11,
  '12-condicionamentos.json': chunk12,
  '13-terrenos.json': chunk13,
  '14-periodos-processos.json': chunk14,
  '15-arco-besta.json': chunk15,
  '16-campos-treino.json': chunk16,
  '17-caes.json': chunk17,
  '18-cetraria.json': chunk18,
};

/** The file names imported above, in manifest order. */
export const chunkFiles: readonly string[] = Object.keys(chunkModules);

/** All 506 questions in id order. */
export const questions: readonly Question[] = (Object.values(chunkModules).flat() as Question[]).sort(
  (a, b) => a.id - b.id,
);

export const sections: readonly Section[] = manifest.sections;
export const topics: readonly Topic[] = manifest.topics;

const byId = new Map<number, Question>(questions.map((q) => [q.id, q]));
const sectionBySlug = new Map<string, Section>(sections.map((s) => [s.slug, s]));
const topicBySlug = new Map<string, Topic>(topics.map((t) => [t.slug, t]));

export const questionById = (id: number): Question | undefined => byId.get(id);

export const questionsInSection = (slug: string): Question[] => questions.filter((q) => q.section === slug);

export const questionsInTopic = (slug: string): Question[] => questions.filter((q) => q.topic === slug);

export const sectionOf = (question: Question): Section | undefined => sectionBySlug.get(question.section);

export const topicOf = (question: Question): Topic | undefined => topicBySlug.get(question.topic);

/**
 * PHASE 2 HOOK: translations/en/ and hints/en/ do not exist yet. When phase 2 lands the
 * files, import each one here (same names as the chunk files, one import line each, as
 * for chunkModules) and list them in these two arrays. import.meta.glob was not used
 * because tsc needs Vite client type shims for it, and the files are few and named.
 */
const translationFiles: readonly (readonly Translation[])[] = [];
const hintFiles: readonly (readonly Hint[])[] = [];

const translationById = new Map<number, Translation>(translationFiles.flat().map((t) => [t.id, t]));
const hintById = new Map<number, Hint>(hintFiles.flat().map((h) => [h.id, h]));

/** The English translation for an id, or undefined while no file holds it. */
export const translationFor = (id: number): Translation | undefined => translationById.get(id);

/** The hint for an id, or undefined while no file holds it. */
export const hintFor = (id: number): Hint | undefined => hintById.get(id);
