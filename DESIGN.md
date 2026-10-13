# Caçador — Design

Settled 2026-10-13. A personal practice app for the Portuguese hunting licence theory
exam. The decisions in § 9 win over anything else in this file or in `CLAUDE.md`.

## 1. Purpose and exam facts

One learner (Ross), fluent in English, learning Portuguese, sitting the ICNF theory
exam for the carta de caçador. The exam is in Portuguese, so practice is in Portuguese;
English exists to unblock a word, never as a reading mode.

Exam format, from Portaria 140-B/2016 (article 3 of the exam rules):

| Fact | Value |
| --- | --- |
| Questions per exam | 20, drawn from the official bank |
| Options per question | two or three in law; three in every question of the bank |
| Duration | 30 minutes |
| Pass mark | 75 % correct, so 15 of 20 |

The official bank is the ICNF document "Questionário - Manual para Exame de Carta de
Caçador" (2016). It has 506 questions in 11 sections. The copy in
`packages/data/source/questionario-2016.pdf` is byte-identical (same MD5) to the file
ICNF hosted on 2026-10-12 at https://www.icnf.pt/api/file/doc/2d8ae1589afbdf1e. Nobody
publishes an English version; Cinergética (https://www.cinergetica.pt/en) is the best
existing simulator and keeps the questions in Portuguese.

## 2. Source material

### 2.1 Structure of the PDF

52 pages, text extractable with `pdftotext`, 17 embedded JPEG placements. An intro
paragraph, then 11 all-caps section headings, each followed by its questions. Question
ids are global and the sections are contiguous runs:

| Ids | Count | Section heading in the PDF | Slug |
| --- | --- | --- | --- |
| 1–10 | 10 | DOCUMENTOS DO(A) CAÇADOR(A) | documentos |
| 11–58 | 48 | CONCEITOS BÁSICOS | conceitos-basicos |
| 59–320 | 262 | BIOLOGIA | biologia |
| 321–361 | 41 | ESPÉCIES NÃO CINEGÉTICAS | nao-cinegeticas |
| 362–412 | 51 | CONDICIONAMENTOS VENATÓRIOS GERAIS | condicionamentos |
| 413–415 | 3 | TERRENOS CINEGÉTICOS | terrenos |
| 416–462 | 47 | PERIODOS, PROCESSOS E CONDICIONAMENTOS VENATÓRIOS | periodos-processos |
| 463–474 | 12 | CAÇA COM ARCO E BESTA | arco-besta |
| 475–479 | 5 | CAMPOS DE TREINO | campos-treino |
| 480–498 | 19 | CÃES DE CAÇA | caes |
| 499–506 | 8 | CAÇA DE CETRARIA | cetraria |

Every question has exactly three options A, B, C and exactly one is marked with `*`.

### 2.2 Extraction hazards

Each of these broke an earlier parse. The extractor handles all of them and the
validator (§ 4) catches a regression.

1. The number separator varies: `234 - `, `235 – ` (en dash), `284- ` (no space before
   the hyphen).
2. The `*` marking the correct option is sometimes glued to the word (`Zarro-comum*`)
   and sometimes after a space; it can sit at the end of a wrapped continuation line.
3. Stems and options wrap over several lines. A line ending in `-` is a hyphenated word
   split by the wrap (`perdiz-` / `vermelha`), rejoined without a space. Questions 411
   and 455 are the two cases.
4. A section heading follows the last option of the previous section with no blank
   line; the old parse glued `CONCEITOS BÁSICOS` and the other headings onto the last
   option of questions 10, 58, 320, 361, 412, 415, 462, 474, 479 and 498.
5. Option B of question 1 wraps with `ICNF` alone on its own line, which looks like a
   heading. A heading is an all-caps line that is one of the eleven in § 2.1, nothing
   else.
6. The intro paragraphs before question 1 are not a question. `pdftotext` emits a form
   feed between pages and no running headers or page numbers.
7. Curly quotes (“espelho alar”) and the apostrophe in galinha-d’água are kept as they
   are in the PDF.
8. The `pdftotext` mode matters. The default mode drops the hyphen at a wrapped line end
   (`pôr-do-` / `sol` comes out `pôr-dosol` in 411 and `perdiz-` / `vermelha` comes out
   `perdizvermelha` in 455) and `-raw` drops spaces on some justified lines (412 options B
   and C, 443, 455 and 461, for example `Desaltoedecetraria`). The extractor uses
   `-layout`, which keeps both, and rejoins a line ending in `-` to the next without a
   space.

### 2.3 Images

15 distinct pictures. 14 species photos belong to the questions whose stem is "A
seguinte figura representa", one sign (a rectangle, red upper half, white lower half,
the PDF prints "(vermelho)" on it) is shown for four questions that say "este sinal".
Question 286 contains the word figura but has no picture. Placement in the PDF, found
from the text positions `pdftohtml -xml` reports:

| Page | Placement on the page | Question | File |
| --- | --- | --- | --- |
| 13 | 1st | 119 | q119.jpg |
| 15 | 1st | 143 | q143.jpg |
| 18 | 1st, 2nd | 168, 169 | q168.jpg, q169.jpg |
| 21 | 1st | 198 | q198.jpg |
| 24 | 1st, 2nd | 228, 229 | q228.jpg, q229.jpg |
| 27 | 1st, 2nd, 3rd | 261, 267, 268 | q261.jpg, q267.jpg, q268.jpg |
| 29 | 1st | 280 | q280.jpg |
| 30 | 1st | 293 | q293.jpg |
| 32 | 1st, 2nd | 319, 320 | q319.jpg, q320.jpg |
| 38 | 1st, 2nd | 373, 375 | sinal.jpg (same picture) |
| 40 | 1st | 394, and 397 which refers to it | sinal.jpg |

A picture sits immediately above or below its question's stem; within a page the
pictures appear in question order.

### 2.4 Reference parse

`packages/data/source/reference-2026-05.json` is the earlier, independent extraction
of the same PDF (506 questions, old flat shape). Its answers are right for all 506
questions. Its text has the glitches in § 2.2 items 3 and 4 and is otherwise right. The
extractor's acceptance compares against it.

## 3. Data layout

Everything lives in `packages/data`. Portuguese is the source of truth and is only
written by the extractor; English and hints are hand-maintained and mirror the ids.
Agents work on one chunk file at a time, so no file holds more than 51 questions and
no file spans two sections.

```
packages/data/
  manifest.json              sections, topics, chunks, images (hand-maintained spec)
  source/
    questionario-2016.pdf    the official bank
    reference-2026-05.json   the earlier parse, for cross-checking only
  questions/                 Portuguese, written by scripts/extract.mjs
    01-documentos.json
    …                        18 files, table below
    18-cetraria.json
  translations/en/           same 18 file names, English
  hints/en/                  same 18 file names, language notes and nudges
  images/                    q119.jpg … q320.jpg and sinal.jpg
  glossary/
    species.json             { pt, scientific, en, group }, one entry per surface form (§ 3.3)
    terms.json               { pt, en, note }, hunting and legal vocabulary (§ 3.3)
  scripts/
    extract.mjs              PDF to questions/ and images/, deterministic
    validate.mjs             the rules in § 4, run by pnpm lint
    lib/
      manifest.mjs           dataDir and the range and image lookups both scripts share
      parse.mjs              the PDF text parser, pure, unit-tested on the § 2.2 hazards
      validate.mjs           the rule checks as functions, imported by extract.mjs and the tests
  src/
    index.ts                 typed loader for the app and the tests
  test/
    fixtures/valid/          a 4-question data directory the validator tests copy and break
```

### 3.1 Chunks

| File | Ids | Count | Section | Contents |
| --- | --- | --- | --- | --- |
| 01-documentos.json | 1–10 | 10 | documentos | |
| 02-conceitos-basicos.json | 11–58 | 48 | conceitos-basicos | |
| 03-biologia-coelho-lebre.json | 59–104 | 46 | biologia | rabbit, hare |
| 04-biologia-raposa-javali.json | 105–136 | 32 | biologia | fox, mongoose, boar |
| 05-biologia-veado-corco.json | 137–167 | 31 | biologia | fallow deer, red deer, roe deer, mouflon |
| 06-biologia-perdiz.json | 168–197 | 30 | biologia | red-legged partridge |
| 07-biologia-pombos-codorniz.json | 198–227 | 30 | biologia | pigeons, turtle dove, quail |
| 08-biologia-patos.json | 228–266 | 39 | biologia | ducks, moorhen, coot |
| 09-biologia-pombos-galinhola-narcejas.json | 267–303 | 37 | biologia | pigeons again, woodcock, snipe |
| 10-biologia-tarambola-tordos.json | 304–320 | 17 | biologia | golden plover, thrushes, blackbird |
| 11-nao-cinegeticas.json | 321–361 | 41 | nao-cinegeticas | |
| 12-condicionamentos.json | 362–412 | 51 | condicionamentos | |
| 13-terrenos.json | 413–415 | 3 | terrenos | |
| 14-periodos-processos.json | 416–462 | 47 | periodos-processos | |
| 15-arco-besta.json | 463–474 | 12 | arco-besta | |
| 16-campos-treino.json | 475–479 | 5 | campos-treino | |
| 17-caes.json | 480–498 | 19 | caes | |
| 18-cetraria.json | 499–506 | 8 | cetraria | |

Biology is split along the species runs the PDF already follows, so a file is one
coherent group to translate or review (decision 2026-10-13). 12-condicionamentos has
51 questions; splitting it would cut the section in two for one question.

### 3.2 Topics

The topic is what the per-category weakness report groups by. Outside Biology the topic
is the section slug. Inside Biology there is one topic per species or small group,
assigned by id range (decision 2026-10-13):

| Topic slug | Ids | English |
| --- | --- | --- |
| coelho | 59–87 | Wild rabbit |
| lebre | 88–104 | Iberian hare |
| raposa | 105–112 | Red fox |
| saca-rabos | 113–122 | Egyptian mongoose |
| javali | 123–136 | Wild boar |
| gamo | 137–142 | Fallow deer |
| veado | 143–157 | Red deer |
| corco | 158–164 | Roe deer |
| muflao | 165–167 | Mouflon |
| perdiz | 168–197 | Red-legged partridge |
| pombos-rolas | 198–212, 267–279 | Pigeons and doves |
| codorniz | 213–227 | Common quail |
| patos | 228–255 | Ducks |
| galinha-d-agua | 256–261 | Moorhen |
| galeirao | 262–266 | Coot |
| galinhola | 280–292 | Woodcock |
| narcejas | 293–303 | Snipe |
| tarambola | 304–308 | Golden plover |
| tordos | 309–320 | Thrushes, blackbird and the corvid pictures |

A few questions inside a run compare several species (227, 244, 304, 317); they keep
the topic of their run.

### 3.3 Shapes

A Portuguese question, one entry in a `questions/` file (an array sorted by id):

```json
{ "id": 229, "section": "biologia", "topic": "patos", "image": "q229.jpg",
  "question": "A seguinte figura representa:",
  "options": { "A": "Arrabio", "B": "Frisada", "C": "Pato-real" },
  "answer": "C" }
```

`image` is present only on the 18 questions in § 2.3. Text is single-line, trimmed,
single-spaced, with no `*` and no heading text.

An English translation, one entry in a `translations/en/` file:

```json
{ "id": 229, "question": "The picture shows a:",
  "options": { "A": "Northern pintail", "B": "Gadwall", "C": "Mallard" },
  "status": "draft", "notes": "" }
```

`status` is `draft` (the translator's pass), `checked` (glossary and side-by-side
meaning pass done) or `reviewed` (Ross read it). `notes` records anything a reviewer
should know: an ambiguity the meaning pass could not resolve, never a change it made.
The rules for writing and checking an entry are in § 5 step 2.

A species, one entry in `glossary/species.json` (an array):

```json
{ "pt": "arrabio", "scientific": "Anas acuta", "en": "Northern pintail", "group": "patos" }
```

`pt` is the name as the bank prints it, and a singular and a plural are separate
entries. `en` follows § 5 step 2 rule 9. The glossary holds every species name the bank
uses plus every species of Portaria 67/2024
(diariodarepublica.pt/dr/detalhe/portaria/67-2024-853384722). `group` follows one rule
(decision 2026-10-13): the manifest topic slug of the species' family when it has one
(`coelho`, `perdiz`, `patos` for every duck, `tordos` for every thrush, `pombos-rolas`
for pigeons and doves); `nao-cinegeticas` for a protected species; `outras-cinegeticas`
for a game species with no topic (corvids, starling, geese).

A term, one entry in `glossary/terms.json` (an array):

```json
{ "pt": "cetraria", "en": "falconry", "note": "" }
```

The terms glossary holds the hunting and legal vocabulary: the hunting methods, the
kinds of hunting ground, the documents and the legal periods. `pt` is unique and in the
bank's surface form; `en` is the one English every translation uses for it; `note` is a
string, empty or saying when the term applies or how it differs from a near neighbour.
Rule 7 in § 4 checks the shape only; whether a translation uses the term is the meaning
pass's job, not a rule's.

A hint, one entry in a `hints/en/` file:

```json
{ "id": 7,
  "language": [
    { "pt": "caçar só às narcejas", "en": "hunt snipe only",
      "note": "à/aos after caçar marks the target species; só limits it to that species" },
    { "pt": "numa única região cinegética", "en": "in a single hunting region", "note": "" }
  ],
  "nudge": "One region, so a regional licence is enough. The waterfowl licence is a separate extra.",
  "patterns": ["species-preposition", "so-only"],
  "status": "draft" }
```

`language` lists the words in this sentence that change its meaning for an English
reader, and is safe to show before answering. `nudge` points at the fact behind the
answer and is shown only after answering. `patterns` tags the recurring constructions
(desde que, apenas, só … se, bem como, à exceção de, nos … que antecedem, the species
preposition, caduca, aos casais, em bandos, negative stems) so the app can report
which constructions trip the learner.

### 3.4 Manifest

`manifest.json` is hand-maintained and drives both the extractor and the validator:

```json
{ "sections": [ { "slug": "biologia", "heading": "BIOLOGIA", "pt": "Biologia", "en": "Biology",
                  "from": 59, "to": 320 } ],
  "topics":   [ { "slug": "patos", "pt": "Patos", "en": "Ducks", "section": "biologia",
                  "ranges": [[228, 255]] } ],
  "chunks":   [ { "file": "08-biologia-patos.json", "section": "biologia", "from": 228, "to": 266 } ],
  "images":   [ { "file": "q229.jpg", "page": 24, "index": 2, "questions": [229] },
                { "file": "sinal.jpg", "page": 38, "index": 1, "questions": [373, 375, 394, 397] } ] }
```

The tables in § 2.1, § 2.3, § 3.1 and § 3.2 are its contents. `heading` is the all-caps
section heading exactly as the PDF prints it; the extractor uses it to split sections
and the validator to reject heading text, so neither script hard-codes a heading.

## 4. Validation rules

`scripts/validate.mjs` runs in `pnpm lint` and fails on the first rule broken, naming
the file and id. Rules:

1. Across `questions/`, ids 1 to 506 appear exactly once; each file holds exactly the
   ids its manifest chunk names, sorted; no file has more than 51 entries.
2. Every entry's `section` equals its chunk's section; its `topic` exists in the
   manifest and one of that topic's ranges contains the id.
3. `options` has exactly the keys A, B, C, each a non-empty single-line string;
   `answer` is one of them; no field contains `*`, a section heading, two consecutive
   spaces, whitespace other than a plain space (a tab, a no-break space, U+2028), or
   leading or trailing whitespace.
4. The questions the manifest lists under `images` carry that `image`, no other
   question has one, every listed file exists in `images/`, and every file in `images/`
   is listed.
5. When `translations/en/` or `hints/en/` has a file, it has the same name as a
   `questions/` file, the same ids once each, the same option keys, and a `status` from
   the three allowed values; each entry carries the other fields of § 3.3 with their
   types (strings non-empty except `notes`, `note` and `nudge`). A `language` entry's
   `pt` text occurs in the question or its options.
6. Once `glossary/species.json` exists: for every Portuguese species name in a
   question, the matching English name is present in its translation (case-insensitive).
   Skipped for entries with status `draft`. Every glossary entry has non-empty `pt`,
   `scientific`, `en` and `group`, and `pt` is unique, ignoring case and curly-versus-straight quotes. The glossary `pt` must be the
   surface form used in the bank: a whole-word, case-insensitive match in which a
   hyphen counts as part of the word (`Perdiz` does not match inside `perdiz-cinzenta`),
   curly apostrophes and quotes are read as straight ones, and a plural is its own
   entry. An entry that matches no question is allowed, because the glossary also
   holds species of Portaria 67/2024 that the bank never names.
7. Once `glossary/terms.json` exists: every entry has non-empty `pt` and `en` and a
   `note` that is a string (empty allowed), and `pt` is unique in the same sense as rule 6. Only the shape is
   checked; a term inflects in running text, so its use in a translation is left to the
   meaning pass (§ 5 step 2).

The manifest itself is checked first: every entry has the fields of § 3.4 with their
types and a unique slug or file name, section ranges tile 1 to 506, chunk ranges tile
1 to 506 without crossing a section, topic ranges tile every section, and every image
names existing questions, each under one image only.

## 5. Pipeline

Four phases, each its own epic, in order.

1. **Extract** (done, cac-eo6): workspace, manifest, extractor, images, validator,
   loader.
2. **Translate** (phase 2, epic cac-qre): the species and terms glossaries first
   (§ 3.3), then a translator's pass per chunk file, then a side-by-side meaning pass
   per chunk file by a different agent; every entry ends at `checked`. A bead owns one
   to four chunk files totalling 37 to 63 questions and works them one file at a time;
   the meaning-pass beads mirror the translation beads' groups one to one. The English
   in the earlier cacador-quiz project was found wrong and inconsistent on species and
   terms (a 39-question sample on 2026-10-13: arrabio as teal, narceja-galega as great
   snipe, de salto three different ways) and is not an input. A translator or
   meaning-pass worker follows these rules:

   1. Translate fresh from the Portuguese in `questions/`. No earlier English is
      opened, the cacador-quiz files included.
   2. Read `glossary/species.json` and `glossary/terms.json` before the first entry.
      A species or term the bank uses is written as the glossary's `en`, the same in
      every stem and option. A species or term a glossary lacks is not added inside
      the bead: write the name the glossary would hold (rule 9 for a species) and list
      it in the bead's close reason, for one "Glossary additions" bead at the end of
      the phase.
   3. Register is literal-leaning: keep the Portuguese order and structure where
      English allows, so the English maps onto the sentence the learner is reading.
      British spelling (licence, metres, colour). Numbers, units and times as the
      Portuguese has them; a bare number or a proper name is copied unchanged.
   4. A Portuguese term with no English equivalent (montaria, listado, farropo,
      morouços, terçó) stays in Portuguese, followed in parentheses by the gloss the
      terms glossary gives it.
   5. Each entry has the § 3.3 shape, the ids and option keys of its Portuguese file.
      Keep the keyed option right and the other two wrong in English as they are in
      Portuguese.
   6. The translator leaves every entry at `draft` with `notes` empty. Rule 6 skips
      `draft`, so a half-finished file never fails lint.
   7. The meaning pass is a second agent, never the translator of the same file. It
      reads `pt` and `en` side by side, rewrites the English where it drifts from the
      Portuguese, breaks a glossary, or would make the keyed option wrong, and sets
      `status` to `checked`; from then rule 6 binds.
   8. `notes` is written only by the meaning pass and only for an ambiguity it could
      not resolve: a reading of the Portuguese it cannot settle, or a term with no
      clean English. A fix it made goes in the bead's close reason with the ids it
      changed, never in `notes`.
   9. A species' `en` is the common name as British field guides print it, in its full
      form where one exists (Northern pintail, Eurasian wigeon, Common snipe, Jack
      snipe), capitalised as a name; rule 6 matches case-insensitively, so running text
      may lowercase it. Its `scientific` is as Portaria 67/2024 prints it, else the
      current IOC name.
   10. No entry is set to `reviewed` in this phase; Ross flips it while studying, through
       the app phase.
   11. A Portuguese term whose English rendering or gloss would by itself pick the keyed
       option stays in Portuguese, without a gloss, in the stem and the options; the rest
       of the sentence is translated. This is the case in a question that asks for a
       name or what a name means (what groups of boar are called, which teeth are called
       navalhas, the name of a young boar under six months, what brama is). A gloss there
       would give the answer away during a peek.
3. **Hints**: one agent per chunk file writes `language`, `nudge` and `patterns` for
   each question by reading the sentence as a learner; a second pass checks the nudge
   agrees with the keyed answer and every `language.pt` occurs in the question.
4. **App**: § 6 to § 8.

## 6. App behaviour

- **Practice**: one random question at a time, in Portuguese, until the learner stops.
  No end, no session target.
- **Peek**: press and hold a button to see the English question and options; release
  and the Portuguese returns. It is never a toggle and cannot be left on.
- **Hint**: before answering, shows the `language` notes only; after answering, adds
  the `nudge`. Shown only when asked for.
- **Answering**: tap an option; the result is shown at once with the correct option
  marked; next question on tap.
- **Weighting across sessions**: each practice draw is random with weights. Never seen
  and recently wrong weigh more; a question answered right three times in a row weighs
  least. Weights come from the per-question state, so the next session starts with the
  weak questions nearer the front but never exclusively.
- **Mock exam**: 20 questions drawn uniformly, a 30-minute clock, no feedback until the
  end, then the score against the 15-of-20 line and a review of the wrong ones.
- **Progress**: per-question history; accuracy over time; accuracy per topic and per
  section; accuracy per hint pattern; a readiness score, defined as the fraction of
  questions the learner would get right if the exam were drawn now, computed from each
  question's recent results with unseen questions counted as unknown, shown against
  75 %.
- **Flags**: a "translation is off" and a "hint is off" tap on any question, kept with
  the progress and exported with it.
- **Export and import** of all progress as one JSON file.

## 7. On-device storage

IndexedDB through the `idb` wrapper, behind one storage module nobody else imports
IndexedDB around. Stores:

- `answers`: append-only, one record per answer: question id, timestamp, correct,
  mode, exam id. Indexed by question id and by timestamp.
- `questionState`: one record per question: attempts, correct, current streak, last
  seen, current weight. Updated on each answer; what practice reads at start.
- `exams`: one record per mock exam: question ids, answers, score, timestamps.
- `flags`: translation and hint flags.

localStorage, keys prefixed `cacador.`, only for tiny synchronous settings (theme, last
mode). The app requests persistent storage on first run. Export and import cover every
store.

## 8. Stack and conventions

Mirrors Sumit (`/Users/ross.lote/Projects/personal/mathracer/mathracer`), the
precedent for every choice here, minus the server: this app has no backend.

- pnpm workspace, Node 26 (`.nvmrc`), pnpm 11 pinned in `packageManager`, Corepack not
  used, `minimumReleaseAge: 4320` with no exclusions.
- `packages/data` (this epic) and later `apps/web`: Vite, React 19, TypeScript,
  Tailwind v4, react-router v7 in library mode, shadcn/ui on Base UI, Radix banned,
  vitest with jsdom and Testing Library, Playwright for e2e.
- Lint gate: `eslint . --max-warnings 0`, `tsc --noEmit` per workspace, the data
  validator. Test gate: vitest per workspace.
- Installable and offline: web manifest plus a service worker that caches the app shell
  and the data files.
- Hosting: a static site; no server process. Decided when the app phase is planned.
- No pull requests, recorded walkthroughs or deploy ceremony: this is a personal
  project (decision 2026-10-13). A bead is done when its acceptance holds and lint and
  tests are green; work is committed to `main`.

## 9. Decision record

- **2026-10-12, Use Cinergética first.** Reversed 2026-10-13: its manual and questions
  are Portuguese-only and unreadable for a learner, so the app is built.
- **2026-10-13, Chunk files.** No file over 51 questions, none spanning two sections,
  Biology split along species runs (§ 3.1). Reason: agents struggle with long files;
  a file that is one species group is one coherent job.
- **2026-10-13, Topics per species.** One topic per species or small group in Biology,
  the section elsewhere (§ 3.2). Reason: "ducks 55 %" is actionable, "Biology 71 %" is
  not.
- **2026-10-13, Portuguese files are generated, English and hints are maintained.**
  The extractor owns `questions/`; corrections go into its table so a rerun reproduces
  them. English and hints mirror ids in separate files per language.
- **2026-10-13, Peek is press-and-hold, never a toggle.** Reason: English must stay a
  way to unblock a word, not a reading mode.
- **2026-10-13, Hints are language notes first, nudge second.** The notes explain the
  Portuguese constructions that change the meaning and are safe before answering; the
  nudge appears after answering.
- **2026-10-13, IndexedDB for progress.** Append-only answer log plus derived
  per-question state (§ 7); localStorage only for settings.
- **2026-10-13, No epic ceremony.** No pull requests, no recorded walkthrough, no
  deploy step; beads carry the plan, lint and tests carry the proof.
- **2026-10-13, Beads prefix `cac`, JSONL committed.** No Dolt remote;
  `export.auto` is on and the git hooks are installed so `.beads/issues.jsonl` travels
  with every commit.
- **2026-10-13, Translations are written fresh.** One agent per group of chunk files,
  both glossaries as READ FIRST; the earlier cacador-quiz English is never opened by a
  worker (§ 5 step 2). Reason: a 39-question sample plus a tally of every species option
  found it wrong and inconsistent on species (arrabio as teal, pato-trombeteiro as
  wigeon and as goldeneye, narceja-galega as great snipe) and on terms (de salto as jump
  method, jump hunting and walk-up); fixing it costs as much as redoing it and keeps its
  anchoring. Record: brief cac-qgb, notes FOUND.
- **2026-10-13, Species glossary scope and group.** `glossary/species.json` holds every
  species name the bank uses, each surface form its own entry, plus every species of
  Portaria 67/2024; `group` is the family's topic slug, else `nao-cinegeticas` or
  `outras-cinegeticas` (§ 3.3). Reason: rule 6 already enforces the shape and allows
  entries the bank never names.
- **2026-10-13, Terms glossary, shape checked only.** `glossary/terms.json` is
  `{ pt, en, note }`, `pt` unique and in the bank's surface form; rule 7 checks its
  shape, and its use in translations is checked by the meaning pass. Reason: terms
  inflect, so a rule matching them in translations would be loose or noisy.
- **2026-10-13, Literal-leaning register.** Portuguese order and structure kept where
  English allows, British spelling, numbers and units as printed; a term with no
  English equivalent stays in Portuguese with the glossary's gloss in parentheses
  (§ 5 step 2 rules 3 and 4). Reason: the peek unblocks a word in the sentence being
  read; it is not a reading mode.
- **2026-10-13, Meaning pass by a second agent.** Never the translator of the same file;
  reads `pt` and `en` side by side, rewrites drift, glossary breaks and anything that
  would make the keyed option wrong, flips `status` to `checked`, and writes `notes`
  only for an ambiguity it could not resolve; its fixes go in the bead's close reason.
  Reason: notes are what a reviewer should know, not a change log.
- **2026-10-13, No hand review in phase 2.** Every entry ends at `checked`; `reviewed`
  is flipped as Ross studies, through the app phase. Reason: `reviewed` means Ross read
  the entry (§ 3.3), so only Ross's own study can set it (brief cac-qgb D6).
- **2026-10-13, Species English names.** The common name as British field guides print
  it, full form where one exists (Northern pintail, Eurasian wigeon, Common snipe, Jack
  snipe), capitalised as a name; scientific name as Portaria 67/2024 prints it, else
  the current IOC name. Precedent: the § 3.3 example. Rule 6 matches case-insensitively,
  so running text may lowercase it.
- **2026-10-13, Translators leave `draft`.** Only the meaning pass flips an entry to
  `checked`, so rule 6 binds from the meaning pass on. Reason: rule 6 skips `draft`; a
  translator's half-finished file must not fail lint.
- **2026-10-13, Translation beads wire their own files and run in series.** Each
  translation bead adds its files to the loader (`packages/data/src/index.ts`, the
  phase 2 hook), so those beads run one after another; meaning-pass beads never touch
  the loader and run in parallel. Reason: the loader test requires every file on disk to
  be wired, and phase 1 chose static imports over `import.meta.glob`.
- **2026-10-13, Bead size for translation.** A bead owns one to four chunk files
  totalling 37 to 63 questions and works them one file at a time; the meaning-pass beads
  mirror the same groups one to one. Reason: agents work one chunk file at a time
  (§ 3.1, `CLAUDE.md`).
- **2026-10-13, Names under test stay unglossed.** In a question that asks for a
  Portuguese name, the names under test stay in Portuguese without a gloss (§ 5 step 2
  rule 11), over the terms glossary's gloss. Reason: cac-qre.6 glossed listado and
  farropo with their ages in the very question that asks which name fits which age, so
  a peek gave the answer away.
