export class ExtractError extends Error {}

/** Throws an ExtractError with `message`. */
export function fail(message: string): never;

export const LETTERS: string[];

/** Collapses every run of whitespace to one space and trims. */
export function clean(s: string): string;

/** Throws an ExtractError naming `where` on empty text or a stray "*". */
export function checkText(where: string, text: string): void;

export interface ParseSection {
  heading: string;
  slug: string;
  from: number;
  to: number;
}

export interface ParseManifest {
  sections: ParseSection[];
}

export interface PdfLine {
  page: number;
  text: string;
}

/** Lines of a pdftotext dump with their 1-based page (pages are separated by a form feed). */
export function toLines(text: string): PdfLine[];

export interface ParsedQuestion {
  id: number;
  page: number;
  section: ParseSection;
  stem: string;
  options: string[];
  answer: string;
}

/** Parses the lines into `total` questions with contiguous ids from 1; throws an ExtractError otherwise. */
export function parseQuestions(lines: PdfLine[], manifest: ParseManifest, total: number): ParsedQuestion[];
