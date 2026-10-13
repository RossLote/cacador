// Placeholder until the loader bead: the manifest and its types (DESIGN.md § 3.4).
import manifestJson from '../manifest.json';

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

export const manifest: Manifest = manifestJson as Manifest;
