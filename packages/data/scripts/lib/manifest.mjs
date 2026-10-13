import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of packages/data. */
export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The hand-maintained spec (DESIGN.md § 3.4) that drives the extractor and the validator. */
export function readManifest() {
  return JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'));
}
