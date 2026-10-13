import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of packages/data. */
export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The hand-maintained spec (DESIGN.md § 3.4) that drives the extractor and the validator; `dir` defaults to packages/data. */
export function readManifest(dir = dataDir) {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
}
