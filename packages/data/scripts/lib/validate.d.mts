export class ValidationError extends Error {
  constructor(message: string);
}

/** A plain object: not null, not an array. */
export function isObject(value: unknown): value is Record<string, unknown>;

/** The translations/en/ or hints/en/ files: how many entries, in how many files, and how many at each status. */
export interface EntryCounts {
  entries: number;
  files: number;
  draft: number;
  checked: number;
  reviewed: number;
}

/** Entries in glossary/species.json and glossary/terms.json, 0 for a file that does not exist. */
export interface GlossaryCounts {
  species: number;
  terms: number;
}

export interface ValidationCounts {
  questions: number;
  files: number;
  sections: number;
  topics: number;
  images: number;
  imageQuestions: number;
  translations: EntryCounts;
  hints: EntryCounts;
  glossaries: GlossaryCounts;
}

/** Reads and parses a JSON file under `dir`; throws a ValidationError naming the file when it cannot. */
export function readJson(dir: string, rel: string): unknown;

/** Checks the manifest's shape, that its ranges tile the bank and that its images name existing questions; throws a ValidationError; returns the bank size. */
export function checkManifest(manifest: unknown): number;

/** Checks the data directory against DESIGN.md § 4; throws a ValidationError naming the file and id of the first broken rule. */
export function validate(dir?: string): ValidationCounts;
