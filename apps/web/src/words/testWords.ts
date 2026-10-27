import type { Word, WordKind } from '@cacador/data';

const word = (pt: string, phrase: string, en: string, kind: WordKind, ids: number[], note = ''): Word => ({
  pt,
  phrase,
  en,
  kind,
  ids,
  note,
});

/**
 * The tests' own list of words, never the loader's, which the writers keep
 * changing (epic cac-zqe Hazard): each phrase is held by one of its questions
 * in the bank, in the stem or in an option, as validator rule 9 requires.
 */
export const TEST_WORDS: readonly Word[] = [
  word('láparo', 'Os láparos nascem', 'rabbit kit', 'life', [75, 83, 97]),
  word('levantar voo', 'patinharem na água antes de levantar voo', 'take off', 'life', [237, 243, 254], 'Of a bird taking off.'),
  word('cio', 'O cio da raposa', 'rut', 'life', [109, 112, 133], 'Heat for the fox, rut for deer, boar and mouflon.'),
  word('toca', 'Tocas de habitação individuais', 'burrow', 'habitat', [8, 64, 65]),
  word('galeria', 'galerias extensas e muito ramificadas', 'tunnel', 'habitat', [64, 66, 94], 'Not a gallery: the tunnels of a burrow.'),
  word('alagadiço', 'locais húmidos e alagadiços', 'waterlogged', 'habitat', [118, 141]),
  word('levantar', 'procurar, perseguir e levantar espécies de caça maior', 'flush', 'method', [19, 40, 55], 'Of game made to break cover.'),
  word('batida', 'por processo diferente do de batida', 'driven hunt', 'method', [30, 38, 39]),
  word('pata', 'Bico e patas vermelhas', 'leg', 'anatomy', [170, 231, 241]),
  word('espelho alar', 'espelho alar geralmente com brilho metálico', 'speculum', 'anatomy', [232, 234, 235]),
  word('seixa', 'também se dá o nome de seixa', 'Stock dove', 'species', [278], 'Another name for pombo-bravo.'),
  word('zagalotes', 'cartuchos carregados com zagalotes', 'buckshot', 'weapon', [388, 389]),
  word('cobrar', 'O setter irlandês cobra bem na água e em terra', 'retrieve', 'dog', [488, 489, 490]),
  word('fiscalização', 'competência na fiscalização da caça', 'enforcement', 'law', [1]),
  word('caducidade', 'o final da sua caducidade', 'expiry', 'law', [3]),
  word('prejuízo', 'que cause prejuízos na agricultura', 'damage', 'general', [53, 335]),
  word('vulgarmente', 'dá-se, vulgarmente, o nome de', 'commonly', 'general', [83, 97]),
];

/** The test word whose Portuguese is `pt`. */
export function testWord(pt: string): Word {
  const found = TEST_WORDS.find((w) => w.pt === pt);
  if (found === undefined) throw new Error(`no test word ${pt}`);
  return found;
}
