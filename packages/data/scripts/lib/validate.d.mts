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

/** Checks the manifest's ranges tile the bank; throws a ValidationError; returns the bank size. */
export function checkManifest(manifest: unknown): number;

/** Checks the data directory against DESIGN.md § 4; throws a ValidationError naming the file and id of the first broken rule. */
export function validate(dir?: string): ValidationCounts;
