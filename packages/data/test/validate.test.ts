import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ValidationError, validate } from '../scripts/lib/validate.mjs';

/** The tiny valid data directory (4 questions, 2 files) the tests copy and break. */
const base = fileURLToPath(new URL('./fixtures/valid', import.meta.url));
const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copyBase(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cacador-validate-'));
  temps.push(dir);
  cpSync(base, dir, { recursive: true });
  return dir;
}

const writeText = (dir: string, rel: string, text: string) => writeFileSync(join(dir, rel), text);
const remove = (dir: string, rel: string) => rmSync(join(dir, rel), { recursive: true, force: true });

interface Row {
  id: number;
  section: string;
  topic: string;
  image?: string;
  question?: string;
  options: Record<string, string | number>;
  answer: string;
  status: string;
  notes?: string;
  language: [{ pt: string; en: string; note: string }, { pt: string; en: string; note: string }] | string;
  nudge: string | number;
  patterns: string[] | string;
}
type Rows = [Row, Row];

interface ManifestTopic {
  slug: string;
  section: string;
  ranges?: number[][];
}
interface ManifestImage {
  file: string;
  page: number;
  index: number;
  questions?: number[];
}
interface ManifestJson {
  sections: [{ from: number; to: number; heading?: string }, { from: number; to: number; heading?: string }];
  topics: [ManifestTopic, ManifestTopic, ManifestTopic];
  chunks: [{ file: string; section: string; from: number; to: number }, { file: string; section: string; from: number; to: number }];
  images: [ManifestImage, ManifestImage];
}

function editJson<T>(dir: string, rel: string, change: (data: T) => void): void {
  const data = JSON.parse(readFileSync(join(dir, rel), 'utf8')) as T;
  change(data);
  writeFileSync(join(dir, rel), JSON.stringify(data, null, 2));
}

const editRows = (dir: string, rel: string, change: (rows: Rows) => void) => editJson<Rows>(dir, rel, change);
const editManifest = (dir: string, change: (m: ManifestJson) => void) => editJson<ManifestJson>(dir, 'manifest.json', change);

/** Copies the base, applies one change and expects validate to fail with a message matching `message`. */
function expectFailure(change: (dir: string) => void, message: RegExp): void {
  const dir = copyBase();
  change(dir);
  let error: unknown;
  try {
    validate(dir);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ValidationError);
  expect((error as Error).message).toMatch(message);
}

describe('validate on the real data', () => {
  it('passes and returns the counts of DESIGN.md § 2 and § 3', () => {
    expect(validate()).toEqual({ questions: 506, files: 18, sections: 11, topics: 29, images: 15, imageQuestions: 18 });
  });
});

describe('validate on the tiny fixture', () => {
  it('passes the valid base', () => {
    expect(validate(base)).toEqual({
      questions: 4,
      files: 2,
      sections: 2,
      topics: 3,
      images: 2,
      imageQuestions: 3,
    });
  });
});

describe('manifest tiling', () => {
  it('fails on a section gap', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.sections[1].from = 4)), /manifest\.json: section beta range 4-4 starts at 4, expected 3/);
  });

  it('fails on a chunk gap before any question file is read', () => {
    expectFailure((dir) => {
      editManifest(dir, (m) => (m.chunks[1].from = 4));
      remove(dir, 'questions');
    }, /manifest\.json: chunk 02-beta\.json range 4-4 starts at 4, expected 3/);
  });

  it('fails on a chunk that crosses a section', () => {
    expectFailure((dir) => {
      editManifest(dir, (m) => {
        m.chunks[0].to = 3;
        m.chunks[1].from = 4;
      });
    }, /manifest\.json: chunk 01-alfa\.json \(1-3\) crosses the edge of section alfa \(1-2\)/);
  });

  it('fails on a chunk range that stops short', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.chunks[1].to = 3)), /manifest\.json: chunk ranges end at 3, expected 4/);
  });

  it('fails on a topic gap', () => {
    expectFailure(
      (dir) => editManifest(dir, (m) => {
        m.topics[2].ranges = [[4, 4]];
        m.topics[1].ranges = [];
      }),
      /manifest\.json: topic perdiz in section beta range 4-4 starts at 4, expected 3 \(gap or overlap\)/,
    );
  });

  it('fails on overlapping topics', () => {
    expectFailure(
      (dir) => editManifest(dir, (m) => (m.topics[2].ranges = [[3, 4]])),
      /manifest\.json: topic perdiz in section beta range 3-4 starts at 3, expected 4 \(gap or overlap\)/,
    );
  });

  it('fails when the topic ranges of a section stop short of its end', () => {
    expectFailure(
      (dir) => editManifest(dir, (m) => (m.topics[2].ranges = [])),
      /manifest\.json: topic ranges of section beta end at 3, expected 4/,
    );
  });

  it('fails on a section with no topic', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.topics as ManifestTopic[]).splice(1)), /manifest\.json: section beta has no topic/);
  });

  it('fails when a chunk names an unknown section', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.chunks[0].section = 'nope')), /manifest\.json: chunk 01-alfa\.json names unknown section nope/);
  });

  it('fails when a topic names an unknown section', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.topics[0].section = 'nope')), /topic alfa names unknown section nope/);
  });
});

describe('manifest shape', () => {
  it('fails on a section without a heading', () => {
    expectFailure((dir) => editManifest(dir, (m) => delete m.sections[0].heading), /manifest\.json: section alfa has no non-empty string "heading"/);
  });

  it('fails on a topic without ranges', () => {
    expectFailure((dir) => editManifest(dir, (m) => delete m.topics[1].ranges), /manifest\.json: topic patos has no list "ranges"/);
  });

  it('fails on a topic range that is not a pair', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.topics[1].ranges = [[3]])), /manifest\.json: topic patos has a range that is not a pair of integers/);
  });

  it('fails on a topic slug listed twice, even across sections', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.topics[0].slug = 'perdiz')), /manifest\.json: topic perdiz is listed twice/);
  });

  it('fails on a chunk without a file name', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.chunks[1].file = '')), /manifest\.json: chunk #2 has no non-empty string "file"/);
  });

  it('fails on an image without questions', () => {
    expectFailure((dir) => editManifest(dir, (m) => delete m.images[0].questions), /manifest\.json: image q2\.jpg has no list "questions"/);
  });

  it('fails on an image that names a question outside the bank', () => {
    expectFailure((dir) => {
      writeText(dir, 'images/stray.jpg', '');
      editManifest(dir, (m) => m.images.push({ file: 'stray.jpg', page: 9, index: 1, questions: [999] }));
    }, /manifest\.json: image stray\.jpg names question 999, which is not in 1-4/);
  });

  it('fails on an image page or index below 1', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.images[0].page = 0)), /manifest\.json: image q2\.jpg needs a page and index of at least 1/);
    expectFailure((dir) => editManifest(dir, (m) => (m.images[1].index = 0)), /manifest\.json: image shared\.jpg needs a page and index of at least 1/);
  });

  it('fails on an image with an empty questions list', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.images[0].questions = [])), /manifest\.json: image q2\.jpg names no question/);
  });

  it('fails when a question sits under two images', () => {
    expectFailure((dir) => editManifest(dir, (m) => (m.images[0].questions = [2, 3])), /manifest\.json: image shared\.jpg names question 3, already under q2\.jpg/);
  });
});

describe('rule 1: ids and files', () => {
  it('fails on a missing id', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => q.pop()), /questions\/01-alfa\.json: id 2: is missing/);
  });

  it('fails on a duplicate id', () => {
    expectFailure(
      (dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[1].id = 3)),
      /questions\/02-beta\.json: id 3: appears again \(first in questions\/02-beta\.json\)/,
    );
  });

  it('fails on an id outside the chunk', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[0].id = 9)), /questions\/02-beta\.json: id 9: is outside the chunk's ids 3-4/);
  });

  it('fails on unsorted ids', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => q.reverse()), /questions\/02-beta\.json: id 3: is out of order/);
  });

  it('fails on a question file the manifest does not list', () => {
    expectFailure((dir) => writeText(dir, 'questions/03-extra.json', '[]'), /questions\/03-extra\.json: is not a chunk in the manifest/);
  });

  it('fails on a chunk file that is missing', () => {
    expectFailure((dir) => remove(dir, 'questions/02-beta.json'), /questions\/02-beta\.json: cannot be read/);
  });

  it('fails on a file with more than 51 entries', () => {
    const dir = copyBase();
    const entries = Array.from({ length: 52 }, (_, i) => ({
      id: i + 1,
      section: 'alfa',
      topic: 'alfa',
      question: 'Pergunta?',
      options: { A: 'a', B: 'b', C: 'c' },
      answer: 'A',
    }));
    writeText(dir, 'manifest.json', JSON.stringify({
      sections: [{ slug: 'alfa', heading: 'ALFA', pt: 'Alfa', en: 'Alpha', from: 1, to: 52 }],
      topics: [{ slug: 'alfa', pt: 'Alfa', en: 'Alpha', section: 'alfa', ranges: [[1, 52]] }],
      chunks: [{ file: '01-alfa.json', section: 'alfa', from: 1, to: 52 }],
      images: [],
    }));
    remove(dir, 'questions/02-beta.json');
    writeText(dir, 'questions/01-alfa.json', JSON.stringify(entries));
    expect(() => validate(dir)).toThrow(/questions\/01-alfa\.json: holds 52 questions, at most 51/);
  });
});

describe('rule 2: section and topic', () => {
  it("fails when the section differs from the chunk's", () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[1].section = 'beta')), /questions\/01-alfa\.json: id 2: section is "beta"/);
  });

  it('fails on a topic that is not in the manifest', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[0].topic = 'nope')), /questions\/02-beta\.json: id 3: topic "nope" is not in the manifest/);
  });

  it("fails when no range of the topic contains the id", () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[1].topic = 'patos')), /questions\/02-beta\.json: id 4: topic "patos" has no range containing this id/);
  });
});

describe('rule 3: options and text', () => {
  it('fails on a missing option key', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => delete q[0].options.C), /questions\/01-alfa\.json: id 1: options must have exactly the keys A, B, C/);
  });

  it('fails on an extra option key', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].options.D = 'x')), /id 1: options must have exactly the keys A, B, C/);
  });

  it('fails on an empty option', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].options.B = '')), /id 1: option B is not a non-empty string/);
  });

  it('fails on an answer outside A, B, C', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].answer = 'D')), /questions\/01-alfa\.json: id 1: answer "D" is not one of A, B, C/);
  });

  it('fails on a newline in the text', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].question = 'Qual\né?')), /id 1: question is not a single line/);
  });

  it.each([
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029'],
    ['U+0085', '\u0085'],
  ])('fails on %s as a line break', (_name, char) => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].question = `Qual${char}é?`)), /questions\/01-alfa\.json: id 1: question is not a single line/);
  });

  it('fails on a tab in the text', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].options.A = 'Dezasseis\tanos')), /questions\/01-alfa\.json: id 1: option A contains whitespace other than a plain space/);
  });

  it('fails on a no-break space in the text', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[1].question = 'Qual\u00a0é?')), /questions\/02-beta\.json: id 4: question contains whitespace other than a plain space/);
  });

  it('fails on an asterisk', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[1].options.A = 'Sim*')), /questions\/02-beta\.json: id 4: option A contains "\*"/);
  });

  it('fails on a section heading, case-sensitively', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[1].question = 'Pergunta BETA?')), /id 4: question contains the section heading "BETA"/);
    const dir = copyBase();
    editRows(dir, 'questions/02-beta.json', (q) => (q[0].question = 'Pergunta beta?'));
    expect(() => validate(dir)).not.toThrow();
  });

  it('fails on two consecutive spaces', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].options.A = 'Dezasseis  anos')), /id 1: option A contains two consecutive spaces/);
  });

  it('fails on leading or trailing whitespace', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].question = 'Qual é? ')), /id 1: question has leading or trailing whitespace/);
  });
});

describe('rule 4: images', () => {
  it('fails when a listed question lacks its image', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => delete q[1].image), /questions\/01-alfa\.json: id 2: image is missing, the manifest lists "q2\.jpg"/);
  });

  it('fails when an unlisted question carries an image', () => {
    expectFailure((dir) => editRows(dir, 'questions/01-alfa.json', (q) => (q[0].image = 'q2.jpg')), /questions\/01-alfa\.json: id 1: has image "q2\.jpg"/);
  });

  it('fails when a question names a different file', () => {
    expectFailure((dir) => editRows(dir, 'questions/02-beta.json', (q) => (q[0].image = 'q2.jpg')), /id 3: image is "q2\.jpg", the manifest lists "shared\.jpg"/);
  });

  it('fails when a listed file is missing from images/', () => {
    expectFailure((dir) => remove(dir, 'images/shared.jpg'), /images\/shared\.jpg: is listed in the manifest but missing/);
  });

  it('fails when a file in images/ is not listed', () => {
    expectFailure((dir) => writeText(dir, 'images/stray.jpg', ''), /images\/stray\.jpg: is not listed in the manifest/);
  });
});

describe('rule 5: translations and hints', () => {
  it('fails on a translation file with no question file of that name', () => {
    expectFailure((dir) => writeText(dir, 'translations/en/03-x.json', '[]'), /translations\/en\/03-x\.json: has no question file of the same name/);
  });

  it('fails on a missing id', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => t.pop()), /translations\/en\/01-alfa\.json: id 2: is missing/);
  });

  it('fails on a duplicate id', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => (t[1].id = 1)), /translations\/en\/01-alfa\.json: id 1: appears more than once/);
  });

  it('fails on an id the question file lacks', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => (t[1].id = 9)), /translations\/en\/01-alfa\.json: id 9: is not an id of questions\/01-alfa\.json/);
  });

  it('fails on different option keys', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => delete t[0].options.C), /translations\/en\/01-alfa\.json: id 1: options must have the keys A, B, C/);
  });

  it('fails on a status that is not allowed', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/02-beta.json', (t) => (t[0].status = 'done')), /translations\/en\/02-beta\.json: id 3: status "done" is not one of draft, checked, reviewed/);
  });

  it('fails on a hint status that is not allowed', () => {
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => (h[1].status = 'done')), /hints\/en\/02-beta\.json: id 4: status "done"/);
  });

  it('fails on a hint with a missing id', () => {
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => h.pop()), /hints\/en\/02-beta\.json: id 4: is missing/);
  });

  it('fails on language text that is not in the question or options', () => {
    expectFailure(
      (dir) => editRows(dir, 'hints/en/02-beta.json', (h) => ((h[1].language as [{ pt: string }, { pt: string }])[0].pt = 'às terças')),
      /hints\/en\/02-beta\.json: id 4: language text "às terças" does not occur/,
    );
  });

  it('fails on empty language text', () => {
    expectFailure(
      (dir) => editRows(dir, 'hints/en/02-beta.json', (h) => ((h[1].language as [{ pt: string }, { pt: string }])[0].pt = '')),
      /hints\/en\/02-beta\.json: id 4: language entry 1 pt is not a non-empty string/,
    );
  });

  it('fails on a language entry without an English rendering', () => {
    expectFailure(
      (dir) => editRows(dir, 'hints/en/02-beta.json', (h) => ((h[1].language as [{ en: string }, { en: string }])[1].en = '')),
      /hints\/en\/02-beta\.json: id 4: language entry 2 en is not a non-empty string/,
    );
  });

  it('fails on a hint whose language is not a list', () => {
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => (h[1].language = 'x')), /hints\/en\/02-beta\.json: id 4: language is not a list/);
  });

  it('fails on a hint whose nudge is not a string or patterns not a list of strings', () => {
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => (h[1].nudge = 7)), /hints\/en\/02-beta\.json: id 4: nudge is not a string/);
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => (h[1].patterns = 'x')), /hints\/en\/02-beta\.json: id 4: patterns is not a list/);
    expectFailure((dir) => editRows(dir, 'hints/en/02-beta.json', (h) => (h[1].patterns = [''])), /hints\/en\/02-beta\.json: id 4: patterns entry is not a non-empty string/);
  });

  it('fails on a translation without a question, with a non-string option, or without notes', () => {
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => delete t[0].question), /translations\/en\/01-alfa\.json: id 1: question is not a non-empty string/);
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => (t[0].options.A = 5)), /translations\/en\/01-alfa\.json: id 1: option A is not a non-empty string/);
    expectFailure((dir) => editRows(dir, 'translations/en/01-alfa.json', (t) => delete t[0].notes), /translations\/en\/01-alfa\.json: id 1: notes is not a string/);
  });
});

interface GlossaryEntry {
  pt: string;
  scientific?: string;
  en?: string;
  group?: string;
}

/** Appends a complete glossary entry for `pt` and `en` to the glossary of `dir`. */
const addSpecies = (dir: string, { pt, en }: { pt: string; en: string }) =>
  editJson<GlossaryEntry[]>(dir, 'glossary/species.json', (g) => g.push({ pt, scientific: 'x', en, group: 'x' }));

describe('rule 6: species names', () => {
  it('fails when a checked translation lacks the glossary English name', () => {
    expectFailure(
      (dir) => editRows(dir, 'translations/en/02-beta.json', (t) => (t[0].options.A = 'A duck')),
      /translations\/en\/02-beta\.json: id 3: "Pato-real" must appear as "Mallard"/,
    );
  });

  it('fails on a reviewed translation too', () => {
    expectFailure(
      (dir) => editRows(dir, 'translations/en/02-beta.json', (t) => (t[1].question = 'Is the partridge hunted only on Thursdays?')),
      /id 4: "Perdiz-vermelha" must appear as "Red-legged partridge"/,
    );
  });

  it('skips draft translations', () => {
    const dir = copyBase();
    editRows(dir, 'translations/en/02-beta.json', (t) => {
      t[0].options.A = 'A duck';
      t[0].status = 'draft';
    });
    expect(() => validate(dir)).not.toThrow();
  });

  it('matches whole words only', () => {
    const dir = copyBase();
    addSpecies(dir, { pt: 'pato', en: 'Duck' });
    editRows(dir, 'questions/02-beta.json', (q) => (q[0].options.B = 'Um pato'));
    expect(() => validate(dir)).toThrow(/translations\/en\/02-beta\.json: id 3: "pato" must appear as "Duck"/);
    editJson<GlossaryEntry[]>(dir, 'glossary/species.json', (g) => (g[2]!.pt = 'pat'));
    expect(() => validate(dir)).not.toThrow();
  });

  it('counts a hyphen as part of the word', () => {
    const dir = copyBase();
    // Question 4 says "perdiz-vermelha": "Perdiz" alone must not fire on it, nor "pato" on "pato-real".
    addSpecies(dir, { pt: 'Perdiz', en: 'Grey partridge' });
    addSpecies(dir, { pt: 'pato', en: 'Duck' });
    expect(() => validate(dir)).not.toThrow();
  });

  it('matches a straight apostrophe in the glossary to the bank\u2019s curly one', () => {
    const dir = copyBase();
    editRows(dir, 'questions/02-beta.json', (q) => (q[0].options.B = 'Uma galinha-d\u2019água'));
    addSpecies(dir, { pt: "Galinha-d'água", en: 'Moorhen' });
    expect(() => validate(dir)).toThrow(/translations\/en\/02-beta\.json: id 3: "Galinha-d'água" must appear as "Moorhen"/);
    editRows(dir, 'translations/en/02-beta.json', (t) => (t[0].options.B = 'A moorhen'));
    expect(() => validate(dir)).not.toThrow();
  });

  it('matches curly double quotes in the bank to straight ones in the glossary', () => {
    const dir = copyBase();
    editRows(dir, 'questions/02-beta.json', (q) => (q[0].options.B = 'Uma \u201cfrisada\u201d'));
    addSpecies(dir, { pt: '"frisada"', en: 'Gadwall' });
    editRows(dir, 'translations/en/02-beta.json', (t) => (t[0].options.B = 'A pochard'));
    expect(() => validate(dir)).toThrow(/id 3: ""frisada"" must appear as "Gadwall"/);
  });

  it('accepts a glossary entry that matches no question', () => {
    const dir = copyBase();
    addSpecies(dir, { pt: 'Abetarda', en: 'Great bustard' });
    expect(() => validate(dir)).not.toThrow();
  });

  it.each([
    ['an empty en', (g: GlossaryEntry[]) => (g[0]!.en = ''), /glossary\/species\.json: species Pato-real has no non-empty string "en"/],
    ['an empty pt', (g: GlossaryEntry[]) => (g[0]!.pt = ''), /glossary\/species\.json: species #1 has no non-empty string "pt"/],
    ['a duplicate pt', (g: GlossaryEntry[]) => (g[1]!.pt = 'Pato-real'), /glossary\/species\.json: species Pato-real is listed twice/],
    ['no scientific name', (g: GlossaryEntry[]) => delete g[0]!.scientific, /glossary\/species\.json: species Pato-real has no non-empty string "scientific"/],
    ['no group', (g: GlossaryEntry[]) => delete g[1]!.group, /glossary\/species\.json: species Perdiz-vermelha has no non-empty string "group"/],
    ['an entry that is not an object', (g: GlossaryEntry[]) => g.push('x' as unknown as GlossaryEntry), /glossary\/species\.json: species #3 is not an object/],
  ])('rejects a glossary entry with %s', (_name, change, message) => {
    expectFailure((dir) => editJson<GlossaryEntry[]>(dir, 'glossary/species.json', change), message);
  });

  it('rejects a glossary that is not a list', () => {
    expectFailure((dir) => writeText(dir, 'glossary/species.json', '{}'), /glossary\/species\.json: does not hold a list/);
  });

  it('is skipped when there is no glossary', () => {
    const dir = copyBase();
    remove(dir, 'glossary');
    expect(() => validate(dir)).not.toThrow();
  });
});

describe('rule order', () => {
  it('reports the first broken rule when several are broken', () => {
    expectFailure((dir) => {
      editRows(dir, 'questions/01-alfa.json', (q) => {
        q[0].answer = 'D'; // rule 3
        q[1].section = 'beta'; // rule 2
      });
      writeText(dir, 'images/stray.jpg', ''); // rule 4
    }, /questions\/01-alfa\.json: id 2: section is "beta"/);
  });
});
