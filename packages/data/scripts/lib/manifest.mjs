// Helpers over the hand-maintained spec (DESIGN.md § 3.4); validate.mjs reads and checks it.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of packages/data. */
export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Whether one of the inclusive `ranges` contains `id`. */
export const inRanges = (ranges, id) => ranges.some(([from, to]) => id >= from && id <= to);

/** The topic whose ranges contain `id`, or undefined. */
export const topicOfId = (manifest, id) => manifest.topics.find((t) => inRanges(t.ranges, id));

/** Question id to image file, from the manifest's images. */
export const imageByQuestion = (manifest) =>
  new Map(manifest.images.flatMap((image) => image.questions.map((id) => [id, image.file])));
