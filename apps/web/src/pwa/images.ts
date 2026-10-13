// The image map (phase 4 D14): every picture in @cacador/data/images, imported as a URL through the package's
// ./images/* export, so Vite emits each jpg into dist/assets and the service worker precaches it. Screens show a
// question's picture with imageUrl(question.image); nothing copies the images into public/.
// `?no-inline` keeps every picture a file, whatever its size, so none turns into a data URL the precache cannot see.
import q119 from '@cacador/data/images/q119.jpg?no-inline';
import q143 from '@cacador/data/images/q143.jpg?no-inline';
import q168 from '@cacador/data/images/q168.jpg?no-inline';
import q169 from '@cacador/data/images/q169.jpg?no-inline';
import q198 from '@cacador/data/images/q198.jpg?no-inline';
import q228 from '@cacador/data/images/q228.jpg?no-inline';
import q229 from '@cacador/data/images/q229.jpg?no-inline';
import q261 from '@cacador/data/images/q261.jpg?no-inline';
import q267 from '@cacador/data/images/q267.jpg?no-inline';
import q268 from '@cacador/data/images/q268.jpg?no-inline';
import q280 from '@cacador/data/images/q280.jpg?no-inline';
import q293 from '@cacador/data/images/q293.jpg?no-inline';
import q319 from '@cacador/data/images/q319.jpg?no-inline';
import q320 from '@cacador/data/images/q320.jpg?no-inline';
import sinal from '@cacador/data/images/sinal.jpg?no-inline';

/** File name (as in the manifest's images and a question's `image`) to the built URL, under /cacador/. */
const urlByFile: ReadonlyMap<string, string> = new Map([
  ['q119.jpg', q119],
  ['q143.jpg', q143],
  ['q168.jpg', q168],
  ['q169.jpg', q169],
  ['q198.jpg', q198],
  ['q228.jpg', q228],
  ['q229.jpg', q229],
  ['q261.jpg', q261],
  ['q267.jpg', q267],
  ['q268.jpg', q268],
  ['q280.jpg', q280],
  ['q293.jpg', q293],
  ['q319.jpg', q319],
  ['q320.jpg', q320],
  ['sinal.jpg', sinal],
]);

/** The URL of a picture by its file name, e.g. imageUrl('q119.jpg'); undefined for a name the data does not ship. */
export function imageUrl(file: string): string | undefined {
  return urlByFile.get(file);
}
