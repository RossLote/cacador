export class ValidationError extends Error {
  constructor(message: string);
}

export interface ValidationCounts {
  questions: number;
  files: number;
  sections: number;
  topics: number;
  images: number;
  imageQuestions: number;
}

/** Reads and parses a JSON file under `dir`; throws a ValidationError naming the file when it cannot. */
export function readJson(dir: string, rel: string): unknown;

/** Checks the manifest's shape, that its ranges tile the bank and that its images name existing questions; throws a ValidationError; returns the bank size. */
export function checkManifest(manifest: unknown): number;

/** Checks the data directory against DESIGN.md § 4; throws a ValidationError naming the file and id of the first broken rule. */
export function validate(dir?: string): ValidationCounts;
