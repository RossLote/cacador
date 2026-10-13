import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of packages/data. */
export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The hand-maintained spec (DESIGN.md § 3.4) that drives the extractor and the validator; `dir` defaults to packages/data. */
export function readManifest(dir = dataDir) {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
}

/** Whether one of the inclusive `ranges` contains `id`. */
export const inRanges = (ranges, id) => ranges.some(([from, to]) => id >= from && id <= to);

/** The topic whose ranges contain `id`, or undefined. */
export const topicOfId = (manifest, id) => manifest.topics.find((t) => inRanges(t.ranges, id));

/** Question id to image file, from the manifest's images. */
export const imageByQuestion = (manifest) =>
  new Map(manifest.images.flatMap((image) => image.questions.map((id) => [id, image.file])));
