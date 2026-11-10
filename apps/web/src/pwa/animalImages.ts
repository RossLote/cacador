// The animal photo map (epic animal-practice D5): every photo in @cacador/data/animals, imported as a URL through the
// package's ./animals/* export, so Vite emits each jpg into dist/assets and the service worker precaches it, and the
// Animals screens work offline. Screens show an animal's photo with animalImageUrl(animal.slug); nothing copies the
// photos into public/. `?no-inline` keeps every photo a file, whatever its size, so none turns into a data URL the
// precache cannot see.
import codorniz from '@cacador/data/animals/codorniz.jpg?no-inline';
import coelho from '@cacador/data/animals/coelho.jpg?no-inline';
import corco from '@cacador/data/animals/corco.jpg?no-inline';
import galeirao from '@cacador/data/animals/galeirao.jpg?no-inline';
import galinhaDAgua from '@cacador/data/animals/galinha-d-agua.jpg?no-inline';
import galinhola from '@cacador/data/animals/galinhola.jpg?no-inline';
import gamo from '@cacador/data/animals/gamo.jpg?no-inline';
import javali from '@cacador/data/animals/javali.jpg?no-inline';
import lebre from '@cacador/data/animals/lebre.jpg?no-inline';
import muflao from '@cacador/data/animals/muflao.jpg?no-inline';
import narcejas from '@cacador/data/animals/narcejas.jpg?no-inline';
import patos from '@cacador/data/animals/patos.jpg?no-inline';
import perdiz from '@cacador/data/animals/perdiz.jpg?no-inline';
import pombosRolas from '@cacador/data/animals/pombos-rolas.jpg?no-inline';
import raposa from '@cacador/data/animals/raposa.jpg?no-inline';
import sacaRabos from '@cacador/data/animals/saca-rabos.jpg?no-inline';
import tarambola from '@cacador/data/animals/tarambola.jpg?no-inline';
import tordos from '@cacador/data/animals/tordos.jpg?no-inline';
import veado from '@cacador/data/animals/veado.jpg?no-inline';

/** An animal's slug (as in @cacador/data's `animals` and the address /animals/<slug>) to its photo's built URL, under /cacador/. */
const urlBySlug: ReadonlyMap<string, string> = new Map([
  ['codorniz', codorniz],
  ['coelho', coelho],
  ['corco', corco],
  ['galeirao', galeirao],
  ['galinha-d-agua', galinhaDAgua],
  ['galinhola', galinhola],
  ['gamo', gamo],
  ['javali', javali],
  ['lebre', lebre],
  ['muflao', muflao],
  ['narcejas', narcejas],
  ['patos', patos],
  ['perdiz', perdiz],
  ['pombos-rolas', pombosRolas],
  ['raposa', raposa],
  ['saca-rabos', sacaRabos],
  ['tarambola', tarambola],
  ['tordos', tordos],
  ['veado', veado],
]);

/** The URL of an animal's photo by its slug, e.g. animalImageUrl('javali'); undefined for a slug the data does not ship. */
export function animalImageUrl(slug: string): string | undefined {
  return urlBySlug.get(slug);
}
