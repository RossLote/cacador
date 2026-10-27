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
no file spans two sections. The words drill's list (§ 3.3, § 6.11) is hand-maintained
too and is the one set of files not cut by chunk: one file per kind of term.

```
packages/data/
  manifest.json              sections, topics, chunks, images (hand-maintained spec)
  source/
    questionario-2016.pdf    the official bank
    reference-2026-05.json   the earlier parse, for cross-checking only
    terms-inventory.json     the 739 terms a sweep of the bank found, a source for the
                             words/ writers only (§ 5 step 5)
    words-sample.json        the 17-entry precedent of words/, read by Ross (§ 5 step 5)
  questions/                 Portuguese, written by scripts/extract.mjs
    01-documentos.json
    …                        18 files, table below
    18-cetraria.json
  translations/en/           same 18 file names, English
  hints/
    patterns.json            { slug, pt, en, note }, the closed list of pattern tags hints use (§ 3.3)
    en/                      same 18 file names, language notes and nudges
  images/                    q119.jpg … q320.jpg and sinal.jpg
  glossary/
    species.json             { pt, scientific, en, group }, one entry per surface form (§ 3.3)
    terms.json               { pt, en, note }, hunting and legal vocabulary (§ 3.3)
  words/                     the words drill's list (§ 3.3), a file per kind, 12 files:
    anatomy.json             anatomy, dog, falconry, general, ground, habitat, law,
    …                        life, method, species, time and weapon
    weapon.json
  scripts/
    extract.mjs              PDF to questions/ and images/, deterministic
    validate.mjs             the rules in § 4, run by pnpm lint
    lib/
      manifest.mjs           dataDir and the range and image lookups both scripts share
      parse.mjs              the PDF text parser, pure, unit-tested on the § 2.2 hazards
      validate.mjs           the rule checks as functions, imported by extract.mjs and the tests
  src/
    index.ts                 typed loader for the app and the tests, the words included
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

A hint, one entry in a `hints/en/` file (entry 7 of `hints/en/01-documentos.json`, the
precedent of § 5 step 3):

```json
{
  "id": 7,
  "language": [
    {
      "pt": "só às narcejas",
      "en": "only snipe",
      "note": "só = only, limiting the species; à/às after caçar marks what is hunted (caçar à perdiz, caçar aos coelhos)."
    },
    {
      "pt": "numa única região cinegética",
      "en": "in a single hunting region",
      "note": "única = one only, not 'unique'."
    }
  ],
  "nudge": "One region, so a licença regional is enough, and the nacional covers it too. Snipe need no waterfowl licence: question 10 asks the same with rabbits and has the same answer.",
  "patterns": ["only", "case"],
  "status": "checked"
}
```

`language` lists, at most four to a question, the words or constructions in the stem
or an option that change the reading of the sentence for an English reader (só, desde
que, não, a partir de, bem como, a false friend like única or processo), and is safe
to show before answering. It never glosses vocabulary the peek already gives, and an
empty list is right on a plain stem. In each entry `pt` is the phrase verbatim from the
question or an option, `en` is the wording the translation uses for that phrase, and
`note` gives its meaning. `nudge` is shown only after answering: at most two sentences
that state the fact behind the keyed answer and what separates a near-miss distractor,
quoting the Portuguese words that carry the fact and never naming the letter; on an
image question it gives the species' distinguishing field marks. It is never empty; § 4
rule 5 enforces that from `checked` on. `patterns` tags the constructions the answer turns on, each a
`slug` of `hints/patterns.json`, so the app can report which constructions trip the
learner. `status` is `draft` (the writer's pass), `checked` (the checker's side-by-side
pass done) or `reviewed` (Ross read it). The shape has no `notes` field. The rules for
writing and checking an entry are in § 5 step 3.

A pattern, one entry in `hints/patterns.json` (an array): `{ slug, pt, en, note }`.

`slug` is the kebab-case tag a hint's `patterns` uses, unique in the list. `pt` is the
construction as the bank prints it, or a short Portuguese label when it has no single
form. `en` is the English name the app's report shows. `note` says what the
construction does to the reading and when to tag it. The list is closed: it is built
from a sweep of the bank, holds about 20 entries and never more than 25, and rule 8 in
§ 4 rejects a tag that is not one of its slugs.

A word, one entry in a `words/` file (the `galeria` entry of `source/words-sample.json`,
the precedent of § 5 step 5):

```json
{ "pt": "galeria", "phrase": "galerias extensas e muito ramificadas", "en": "tunnel", "kind": "habitat", "ids": [64, 66, 94], "note": "Not a gallery: the tunnels of a burrow." }
```

Each entry has exactly these six fields. `pt` is the dictionary headword (`láparo` for
the bank's láparos, `levantar` for its levantadas), or a set phrase whose meaning its
words do not give (`levantar voo`, `espelho alar`); it is unique across the twelve files
in the sense of § 4 rule 6. `ids` lists, ascending, every question whose stem or options
use the word in this entry's sense, inflected forms included; a second sense is its own
entry. `phrase` is a short run of words verbatim from one of those questions, compared
ignoring case and reading curly quotes as straight (the sample lowercases an option's
first letter: `levantar`'s phrase is from question 19's option B); it need not occur in
every named question, and the drill shows the first named question that holds it
(§ 6.11). `en` is the English the translation uses for the word. Where
`glossary/species.json` or `glossary/terms.json` has an entry whose `pt` equals the
word's `pt` in rule 6's sense, `en` equals that entry's `en` ignoring case, and where
that `en` is the Portuguese followed by a gloss in parentheses (montaria, listado,
terçó, baixo-voo), `en` is the gloss. A species is written as the glossary writes it,
capitalised as a name; every other word is lower case. `en` never contains the word's
`pt` as a whole word. `kind` is the kind of the file the entry sits in. `note` is
English, one sentence or two short ones, shown only after answering: written for a false
friend, a second meaning, or a method, role, ground or legal word whose English alone
does not separate it from its neighbours (batida, montaria), and empty otherwise; never
a grammar lesson.

A `words/` file is `<kind>.json`, an array sorted by `pt`, one entry per line as
`source/words-sample.json` lays it out. There is no cap on a file's length: the largest
kind holds about 120 one-line entries, a tenth of a question chunk's text, and one
file per kind keeps the drill's wrong options from the same kind a lookup of one file
(§ 6.11). The twelve kinds, and the category of `source/terms-inventory.json` each one
takes its terms from:

| Kind | Inventory category | Inventory terms | Holds |
| --- | --- | --- | --- |
| species | species | 90 | species names, their other names (seixa) and classes of animal |
| anatomy | anatomy | 86 | body parts, coat and plumage, and the words for shape and size |
| life | behaviour-life | 108 | diet, breeding, the young, groups and behaviour |
| habitat | habitat | 83 | where game lives: burrows, cover, soils, crops and water |
| ground | ground-type | 42 | the kinds of hunting ground and the places hunting keeps away from |
| method | method-role | 31 | the hunting methods, the people in them and what they do |
| weapon | weapon-ammo | 34 | firearms, bows and crossbows, ammunition and their handling |
| dog | dog | 30 | hunting dogs, their breeds and their work |
| falconry | falconry | 11 | falconry and its birds |
| law | legal-admin | 72 | licences, authorities, the people the law names and legal words |
| time | season-time | 33 | the hunting periods, the seasons of breeding and the times of day |
| general | general | 119 | the general exam words that stop a stem being read, plant parts included |

The list holds the hunting, wildlife and legal terms of the bank plus the general exam
words, about 720 of the inventory's 739; § 5 step 5 rule 3 gives what is left out. The
glossaries, translations, hints and questions are never edited for it. The two
`source/` files are a writer's sources, committed unchanged as Ross approved them and
never imported by the app or the validator.

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
   `pt` text occurs in the question or its options, ignoring case and reading curly
   quotes as straight ones. A hint entry at `checked` or
   `reviewed` has a non-empty `nudge`.
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
8. Once `hints/patterns.json` exists: every entry has non-empty `slug`, `pt`, `en` and
   `note`, and `slug` is unique and kebab-case (lowercase letters and digits in words
   joined by single hyphens). Every tag in the `patterns` of every entry in every
   `hints/en/` file is the `slug` of an entry; a tag that is not fails naming the file,
   the id and the slug.
9. `words/` holds exactly the twelve kind files of § 3.3, each an array. Every entry has
   exactly the six fields `pt`, `phrase`, `en`, `kind`, `ids` and `note`; the strings
   are non-empty but `note`, a string with empty allowed; `kind` equals its file's
   kind; `ids` is a non-empty ascending list of distinct bank ids. `pt` is unique across
   the twelve files in the same sense as rule 6. `phrase` occurs in at least one of the
   questions `ids` names, in its stem or an option, ignoring case and reading curly
   quotes and apostrophes as straight ones (§ 3.3), and as whole words, as rule 6 matches
   a name: a letter, digit or hyphen next to either end is no boundary. Where `glossary/species.json` or
   `glossary/terms.json` has an entry whose `pt` equals the word's `pt` in rule 6's
   sense, `en` equals that entry's `en` ignoring case, or its gloss when that `en` is
   the Portuguese followed by a gloss in parentheses; and `en` never contains the
   word's `pt` as a whole word, matched as rule 6 matches. The validator prints a words
   line with the count of files and of words. An empty file passes, so the scaffold and
   a half-run phase stay green.

The manifest itself is checked first: every entry has the fields of § 3.4 with their
types and a unique slug or file name, section ranges tile 1 to 506, chunk ranges tile
1 to 506 without crossing a section, topic ranges tile every section, and every image
names existing questions, each under one image only.

## 5. Pipeline

Five phases, each its own epic, in order.

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
      the phase. Where a terms note's combined form names a species, the species
      glossary's `en` wins ("in the hunting of ducks", "Iberian hare coursing").
   3. Register is literal-leaning: keep the Portuguese order and structure where
      English allows, so the English maps onto the sentence the learner is reading.
      British spelling (licence, metres, colour). Numbers, units and times as the
      Portuguese has them; a bare number or a proper name is copied unchanged. A time
      of day is written on the 24-hour clock ("depois das 16 horas" → "after 16:00");
      a duration stays in hours. Where the Portuguese verb has no stated subject and
      English needs one, write "the hunter" or "they", never "he".
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
   10. No entry is set to `reviewed` in this phase, and the app never sets it either
       (amended by epic cac-eil, D2): `reviewed` stays in the shape unused. An error Ross
       finds while studying is flagged in the app and reaches the files through a bead
       of its own (§ 6.7).
   11. A Portuguese term whose English rendering or gloss would by itself pick the keyed
       option stays in Portuguese, without a gloss, in the stem and the options; the rest
       of the sentence is translated. This is the case in a question that asks for a
       name or what a name means (what groups of boar are called, which teeth are called
       navalhas, the name of a young boar under six months, what brama is). A gloss there
       would give the answer away during a peek. It applies when the answer follows
       from what the English word means (how a method works, what a name denotes), not
       when the question asks a method's legal scope (which game, months or ground it is
       allowed for), where the English name's associations are the field knowledge the
       exam tests.
3. **Hints** (phase 3, epic cac-eyh): the pattern list `hints/patterns.json` first
   (§ 3.3), then a writer's pass per chunk file, then a checker's pass per chunk file by
   a different agent; every entry ends at `checked`. One scaffolding bead first creates
   every missing `hints/en/` file as empty `draft` entries (rule 5 allows empty
   `language`, `nudge` and `patterns`) and wires all 18 files into the loader, so writer
   and checker beads own only their hint files and run in parallel. A bead owns the
   chunk files of one phase 2 translation group (37 to 63 questions) and works them one
   file at a time; the checker beads mirror the writer groups one to one. Writer and
   checker beads run on Opus. A writer or checker follows these rules:

   1. Read `hints/en/01-documentos.json` first: it is the precedent, hand-written and
      read by Ross, and every rule below is shown in it. Then read
      `hints/patterns.json` and both glossaries. For each question read the Portuguese
      in `questions/`, the English in `translations/en/` and the keyed answer side by
      side. The precedent itself goes through the checker's pass like any other file.
   2. A language note is written only for a word or construction that changes the
      reading of the sentence: só, desde que, não, a partir de, bem como, a false
      friend like única or processo. It can sit in the stem or in an option. It is
      never a vocabulary gloss the peek already gives, such as a species or a term the
      translation names. An empty `language` list is right on a plain stem. At most
      four entries per question.
   3. A language note's `pt` is verbatim from the question or the option (§ 4 rule 5
      checks it), its `en` is the wording the translation uses for that phrase, and its
      `note` gives the meaning. The note names the grammar briefly only when the form
      recurs across the bank (the future subjunctive after se, the present subjunctive
      after desde que); elsewhere it gives the meaning only.
   4. A name under test is never glossed in a language note (§ 5 step 2 rule 11
      carries over). In a question that asks for a Portuguese name or what a name
      means, no `language` entry's `pt` is a name under test and no note says what one
      means; the nudge, shown after answering, may.
   5. The nudge is never empty (§ 4 rule 5 enforces it from `checked` on) and is at
      most two sentences. It states the fact behind the keyed answer and what separates a
      near-miss distractor, and quotes the Portuguese words that carry the fact. It
      never names the letter: the app already marks the correct option. An image
      question's nudge gives the species' distinguishing field marks.
   6. A nudge asserts only what the bank itself and the two glossaries establish: no
      law citations, no article numbers, no recollection of the law beyond the keyed
      option. The checker narrows a nudge it cannot confirm to what the keyed option
      asserts. The one exception is an image question's field marks (rule 5): where a
      species photo is the question, the nudge names the visible features a field
      guide gives for the keyed species (plumage, colouring, bill, shape, coat) and
      uses the bank's own Biology questions about that species where they describe it,
      while every legal claim and every non-visual biological claim stays within the
      bank and the glossaries; the four `sinal.jpg` questions are not species photos,
      and their nudges state what the sign means only as their keyed answers establish
      it. A species-photo nudge may also name the distinguishing visible marks of the
      near-miss species in the options, because rule 5 asks what separates the near
      miss and a plumage mark is checkable against any field guide, unlike a
      recollection of the law.
   7. A nudge may cross-reference another question by number ("question 10 asks the
      same with rabbits"), with the fact always stated in words too.
   8. A `patterns` tag is a `slug` of `hints/patterns.json` (§ 4 rule 8) and is applied
      only where the construction is part of what the answer turns on, not on every
      occurrence. In the precedent most entries carry no tag; entry 3 carries none
      because the number decides. A writer who needs a tag the list lacks leaves the
      question untagged and names the construction and the ids in the bead's close
      reason, for the tail bead (cac-eyh.24) that adds the pattern and tags them.
   9. The writer leaves every entry at `draft`. The checker is a different agent, never
      the writer of the same file: it reads the Portuguese, the English, the keyed
      answer and the hint side by side, fixes the hint in place, and sets `status` to
      `checked`; from then § 4 rule 5 requires a non-empty `nudge`. Its fixes go in the
      bead's close reason with the ids; the hint shape has no `notes` field. No entry
      is set to `reviewed` in this phase, and the app never sets it either (amended by
      epic cac-eil, D2): `reviewed` stays in the shape unused, as in step 2 rule 10.
   10. A writer or checker edits only its own `hints/en/` files: never `src/index.ts`,
       the scripts, the tests, `hints/patterns.json`, `translations/` or `questions/`.
       A translation error it finds goes in the bead's close reason with the id and the
       error, for the tail bead (cac-eyh.24) that applies it with `status` left at
       `checked`. A Portuguese error in `questions/` goes into the extractor's
       correction table through a bead of its own (§ 9). A writer's close reason gives
       its count of entries with an empty `language` list, the constructions it left
       untagged for want of a pattern (or none) and the translation errors it found (or
       none); a checker's close reason lists the ids it changed.
   11. Language notes are shown before answering, so together they must not single
       out an option. A note may sit on a phrase found only in the keyed option when
       another option also carries a note (in the precedent's entry 5 the other note,
       'apenas é válida para algumas espécies', is on a distractor). An entry whose
       option-level notes all sit on the keyed option singles it out: that note moves
       to the near miss's matching phrase, is matched by a note there, or is dropped.
   12. The Portuguese is the exam as the official PDF prints it, its own typos
       included ('a Sul o Tejo' in question 92, 'até ás' in question 153). A printed
       typo stays as printed, a language note's `pt` quotes it verbatim (§ 4 rule 5),
       and it is not reported as a Portuguese error; the extractor's correction table
       (rule 10) is for extraction slips only.
   13. A nudge refers to an option by its Portuguese, quoted, never by its letter or
       its place in the list (the first option, the third): the quote points at the
       words that carry the fact, as rule 5 asks.
4. **App** (phase 4, epic cac-eil): § 6 to § 8.
5. **Words** (phase 5, epic cac-zqe): the words drill's list `words/` (§ 3.3) and the
   drill (§ 6.11). One scaffolding bead first creates the twelve kind files holding the
   17 precedent entries, adds § 4 rule 9 to the validator and exports the words from
   the loader, so writer and checker beads own only their kind files. Then a writer's
   pass per group of kinds, about 75 to 120 words a bead, and a checker's pass per
   writer bead by a different agent; a tail bead last applies what their close reasons
   list. Writer and checker beads run on Opus. A writer or checker follows these rules:

   1. Read `source/words-sample.json` first: it is the precedent, hand-written and read
      by Ross, and every rule below is shown in it but one: its `cio` reads "heat, rut",
      and rule 7 makes it "rut", the note keeping heat. Then read both glossaries. The
      precedent's entries sit in their kind files from the scaffolding bead and go
      through the checker's pass like any other entry.
   2. `source/terms-inventory.json` is a starting list, never the truth: the terms of a
      bead's kinds are those of the inventory categories § 3.3 maps to them, and each
      term's forms, ids, English and category are checked against the bank and never
      copied. Neither `source/` file is ever edited.
   3. The list holds the hunting, wildlife and legal terms and the general exam words.
      Left out are the nine months, the three weekdays and the four seasons the
      inventory lists (16 terms), and any term whose only English is the Portuguese
      word itself (ICNF, Instituto de Conservação da Natureza e das Florestas, podengo,
      ogival, and the breeds beagle, pointer and terrier), because an option identical
      to the prompt teaches nothing. A name with an English form stays (Assembleia da
      República as Assembly of the Republic). A word whose meaning is a question's
      answer stays in (seixa in 278, láparos in 83, terçó in 503): knowing the word is
      what that question tests.
   4. `pt` is the dictionary headword, or a set phrase whose meaning its words do not
      give (§ 3.3), unique across the twelve files. A word with two senses is two
      entries, each in the kind of its sense (`levantar`, flush, in method; `levantar
      voo`, take off, in life).
   5. `ids` are found by searching the stems and options of `questions/` for every form
      of the word (plural, feminine, verb forms), never taken from the inventory: every
      question that uses the word in this entry's sense, ascending, and no other.
   6. `phrase` is a short run of words verbatim from one of the named questions, long
      enough to show the sense. The drill shows the first named question that holds it
      (§ 6.11).
   7. `en` is the English the translation in `translations/en/` uses for the word in the
      named questions. Where a glossary has the word (rule 6's sense), `en` is the
      glossary's `en`, or the gloss when that `en` is the Portuguese with a gloss in
      parentheses (montaria, listado, terçó, baixo-voo). A species is capitalised as the
      glossary writes it; every other word is lower case. `en` never contains the word's
      `pt` as a whole word. Where the precedent breaks this rule, the rule wins.
   8. `note` follows § 3.3: English, one sentence or two short ones, written for a
      false friend (galeria, prejuízo), a second meaning (pata, a leg and a female
      duck), or a method, role, ground or legal word whose English alone does not
      separate it from its neighbours (batida, montaria); empty otherwise, never a
      grammar lesson. It is shown only after answering, so it may say what the word
      means even where a question tests it.
   9. `kind` is the kind of the file, chosen by the word's sense in the named questions.
      A file is sorted by `pt`, one entry per line as the precedent lays it out.
   10. The checker is a different agent, never the writer of the same files. It reads
       every entry against its named questions, their translation and the glossaries,
       searches the bank again for the forms the writer missed, and fixes the entry in
       place. A word entry has no status and no notes field.
   11. A writer or checker edits only its own kind files: never the `source/` files,
       `src/index.ts`, the scripts, the tests, the glossaries, `translations/`,
       `hints/` or `questions/`. A word it thinks belongs to another kind, a second
       sense that belongs to another kind, and an inventory term it drops or merges go
       in its close reason, for the tail bead (cac-zqe.19) to apply. A translation or
       glossary slip goes in its close reason too, and the tail bead appends it to
       cac-4x1; it is never fixed in this phase.
   12. A close reason gives the count of entries in the bead's files; every inventory
       term of its categories not carried as its own word and where it went (merged
       into a named word, excluded under rule 3, or sent to another kind); the senses
       for another kind; and the slips for cac-4x1, or none. A checker's close reason
       also lists the entries it changed.

## 6. App behaviour

Built in phase 4 (epic cac-eil). The rules in § 6 to § 8 come from that epic's
decisions D1 to D23 and from the choices the orchestrator made during the epic and
marked reversible, which carry no D number; § 9 records both kinds, and the fixes from
the epic's review fill in detail under them. The Campo design round (epic cac-8cn)
restyled every screen (§ 8.5, § 8.6), replaced Home's buttons with the tab bar
(§ 6.3) and added three things the chosen artboards carry: Weakest topics on Home, the
count answered on the exam-in-progress card and the count unanswered on Submit. The
words drill (§ 6.11) and Home's Words card came in phase 5 (epic cac-zqe). The
app is a static site with no backend: everything it knows about the learner stays on
the device (§ 7).

### 6.1 Language

- The interface is in English on the first visit, always, whatever languages the
  browser reports. Settings switches it to European Portuguese (pt-PT) and back; the
  switch changes every screen at once, is kept in localStorage under `cacador.locale`,
  survives a reload, and `<html lang>` follows it (`en-GB` or `pt-PT`).
- The questions are in Portuguese in either interface language, and their English
  appears only during a peek. The hints are the English files of `hints/en/`.
- The words drill's own words follow the interface; its Portuguese word, phrase and
  sentence are Portuguese, and its options and notes English, in either language
  (§ 6.11).
- Section, topic and pattern names follow the interface: the manifest's or the pattern
  list's `en`, or its `pt` when the interface is Portuguese.
- The one text that does not follow the interface is the Flagged page's copied list
  (§ 6.7), a fixed English format for an agent to read.

### 6.2 The two numbers

- **Readiness**: for each seen question, the share right in its `recent` list (its last
  three answers, or as many as it has); each unseen question counts one third, the
  chance of a guess on three options. The mean over all 506 questions is shown as a
  rounded percentage against the 75 % line, with the count of unseen questions beside
  it. A fresh device shows 33 % and 506 unseen.
- **Group accuracy** of a topic, a section or a pattern: the mean of the same
  per-question share over the group's seen questions. A group with no seen question is
  not started, never 0 %.
- **Draw weight**, computed from the question's state at draw time and never stored:
  unseen 3; wrong last time (attempts above 0, streak 0) 4; streak 1 → 2; streak 2 → 1;
  streak 3 or more → 0.5. An exam answer counts like a practice answer, and an
  unanswered exam question as a wrong one.
- **No-repeat window**: a draw excludes the most recently drawn ids, the window being
  the smaller of ten and half the pool rounded down: ten for the whole bank and any
  pool of twenty or more, five for a pool of eleven, one for a pool of two or three,
  nothing for a pool of one. The ids come from one recent list for the whole app, not
  one per filter: the ten most recently drawn ids, oldest first, an id drawn again
  moving to the end, kept in sessionStorage under `cacador.recent`, so it survives
  moving between screens and a reload in the same tab. A draw over a pool whose window
  is N excludes the last N ids of that list that are in the pool, not the last N drawn
  anywhere: a draw over a filtered pool skips the pool's own recent questions that are
  still in the list even when whole-bank draws came in between, so a few whole-bank
  draws do not let a small topic repeat its last question.

### 6.3 Home

The hub, at `/`, top to bottom:

- The header: the name Caçador, and at its right a control to Settings (a
  sliders icon, accessible name "Settings").
- The readiness plate: readiness against the 75 % line with the unseen count beside it
  (§ 6.2), and a bar with a tick at 75 % and "Pass line 75 %" under it.
- When the storage module returns an unfinished exam, a card for the exam in progress,
  which opens it: "N minutes left · A of 20 answered", A the answers the exam holds
  (the module never returns an exam past its deadline, § 6.5).
- Four cards: Quick 10 ("Weak ones first, then your score"), the one thing to do
  next, filled rust and the width of the column, which opens a round of ten
  (`/practice?round=10`, § 6.4); directly under it Words ("10 terms from the bank ·
  Portuguese to English"), the width of the column with the ink hairline and the
  book-open icon, which opens the words drill (`/words`, § 6.11), Quick 10 staying the
  one rust card; under it, side by side with the ink hairline, Practice
  ("Weak ones first"), which opens practice over the whole bank with no end, and Exam
  ("20 questions · 30 min", the numbers from the study model), which opens `/exam`.
  Each card's accessible name is its title and its line, so a link named exactly
  "Practice" or "Exam" is the tab, never the card.
- Weakest topics: the two lowest started topics by group accuracy, in the Progress
  topic list's worst-first order (§ 6.6), each a row with the name, "Seen x of y" and
  the percentage, linking to focused practice on that topic (§ 6.4), under an "All
  topics" link to Progress. One row when only one topic is started; the section is
  absent while none is, so a fresh device shows none.

**The menu** is a bar of four tabs along the bottom: Home, Practice, Exam and Progress,
named exactly by the navigation words, the current one marked (`aria-current="page"`).
It shows on every screen except the `/exam` route itself: the start screen and the
running exam take the whole screen and keep only the back control. The results
(`/exam/results/<id>`), Words, Settings, Flagged and the not-found page show the bar
with no tab current. Settings is reached from Home's header control, Flagged from
Progress and Settings. Every screen but Home has the back control to Home ("Back to
Home") at the start of its screen header (§ 8.2).

### 6.4 Practice

- One question at a time, in Portuguese, drawn by weight from the pool (§ 6.2), until
  the learner stops: no end, no session target, unless the session is a round (below).
  Each question shows its section, topic and number, so a nudge's cross-reference
  ("question 10 asks the same") can be found, and its picture when it has one.
- **Peek**: press and hold a button to see the English question and options; release
  and the Portuguese returns. It is never a toggle, on any input, and cannot be left on.
  A press on the button never takes the focus from where it was, so Enter still
  advances afterwards. The button and Hint are pinned in the dock directly over the tab
  bar (§ 8.2), so the English reflowing the question never moves the button from under
  a held thumb.
- **Hint**: a Hint button opens a panel with the `language` notes, or a line saying
  there are none when the list is empty, before or after answering. The panel opens
  only when tapped. After answering it adds the `nudge`, so a panel open at the moment
  of answering stays open and gains the nudge. The panel sits after the options and is
  brought into view above the dock as it opens. Once open it stays open for the rest of
  that question and closes on Next, so every question starts with the panel closed.
  The nudge is never shown before answering.
- **Answering**: tap an option. At once the chosen option is marked right or wrong, the
  correct option is marked, the options lock, the answer is recorded, and Next appears;
  Next draws the next question.
- **Flags**: after answering, a row of two taps, "English is off" and "Hint is off". A
  tap creates the flag at once with an empty note and opens a one-line note field; Save
  updates the note; a second tap on the same kind removes the flag. One flag per
  question and kind; a question drawn again shows its existing flags as set. The row
  reads "Report:" before the two taps. Flags are a practice control only: the exam and
  its review have no flags row.
- **Laptop keys**: A, B, C and 1, 2, 3 answer; Enter advances; holding Space peeks for
  as long as it is held. The keys belong to the practice page, not to the question
  card, so the exam leaves Space unbound. They act from the page itself, never from the
  back control, and Enter on a focused button (Hint, Next, a flag) activates that button.
- **Focused practice**: `/practice?topic=<slug>`, `?section=<slug>` or
  `?pattern=<slug>` limits the pool to that group, with the same weights and the same
  app-wide window, its size following the filtered pool. A pattern's pool is every
  question whose hint carries the tag. A chip names the group in the interface
  language. An unknown slug means the whole bank and no chip. Every row of the Progress
  lists links here, so a weak topic is one tap from practice.
- **A round**: `/practice?round=<n>`, n a whole number of at least 1 (anything else is
  endless practice), is the same draw with an end after n answers; Home's Quick 10
  card asks for ten. The screen header's right-hand slot counts the question on
  screen, "3 of 10", in Fraunces 26 px, and reads "10 of 10" on the score. The round's
  last answer puts Finish in place of Next (Enter finishes too); Finish shows the score
  in place of the card, a plate captioned "Round done" with the count right in Fraunces
  64 px and "of 10 right" beside it, no card, no peek and no Hint, and a rust "Another
  10" button that starts a new round of the same size on the same screen. The count
  lives on the screen, not in storage: a change of the query, the Practice tab
  included, or leaving the page ends the round, and every answer counts for progress
  as any practice answer does. A round combines with a focused pool
  (`?topic=<slug>&round=10`).

### 6.5 Mock exam

- Start draws 20 distinct questions uniformly from the whole bank and records the start
  time. A strip of 20 markers shows which are answered and which is current; Previous
  and Next move one at a time, a marker jumps. Movement is free and an answer can be
  changed until Submit. The chosen option is shown and nothing is marked right or wrong;
  a line under the options says so: "Answers are not marked until you submit. No
  English and no hints during the exam." No peek and no Hint during the exam.
- Each answer is saved at the tap, one question at a time, merged into the exam as
  stored. It counts when it was chosen before the deadline, even when its save reaches
  storage after it; an answer the storage module refuses because the exam is over ends
  the exam on this screen too.
- The clock counts down from 30:00, computed from the start time, so it keeps running
  while the app is closed. Reopening the app with an unfinished exam resumes it with
  its answers, from Home's card (which gives the minutes left and the count answered,
  § 6.3) or from `/exam`, on its first unanswered question (the first question when
  every one is answered), where the learner left off.
- Submit reads "Submit · N unanswered" while N questions are unanswered and "Submit"
  once none is, and asks first when questions are unanswered. At 30:00 the exam submits
  itself as it stands.
- Submit runs once: the storage module finishes an exam only while it is still
  unfinished, and the answers are logged only when that succeeded. At Submit, and only
  then, the 20 answers go into the answers log with mode exam and the exam id; an
  unanswered question is logged with no chosen option and correct false. They feed the
  draw weights like any other answer.
- An exam past its deadline (its start time plus 30 minutes) is settled by the storage
  module whenever progress is read (the states, the log, the exams, an exam by id, the
  export, the unfinished exam), so every screen sees it settled: it is
  submitted as it stands, with its finish time and every logged answer's time set to
  the deadline, so it lands on the day it was taken. Home's card therefore never shows
  zero minutes, and an exam left overnight appears among the past exams with its score.
- Results: the score out of 20, worked out from the exam's answers with the current
  answer key (so it always matches the wrong ones listed), against the 15 line, Passed
  (15 or more) or Not passed,
  and the wrong ones, unanswered included, each on the question card revealed: the
  chosen option and the correct one marked (only the correct one for an unanswered
  question), with Hint and peek available at the top of each card and no flags row.

### 6.6 Progress

At `/progress`, top to bottom:

- Readiness and the unseen count in the screen header, "N % · M unseen".
- Accuracy by day: one bar per calendar day for the last 30 days, in the device's time
  zone, each giving that day's answers, practice and exam, and how many were right;
  today is labelled. Plain blocks, no chart library. The bars and "today" follow the
  date: the page reads progress again at local midnight and whenever it is shown again,
  so a page left open overnight or resumed the next day moves on a day.
- Three lists: topics (29, every topic the manifest holds, § 3.2), sections (11) and
  patterns (17, every entry of `hints/patterns.json`). Each row gives the name, the
  group accuracy (§ 6.2) and "seen x of y", or not started. Rows sort worst first with
  the not-started rows last, and each row links into focused practice for its group.
  The open list is kept in the address (`/progress?tab=section` or `?tab=pattern`, the
  topics having none), so back from focused practice returns to the list the row was
  in. Home's Weakest topics are the first two started rows of the topic list, in the
  same order (§ 6.3).
- Past exams, newest finished first, finished exams only (an unfinished exam is Home's
  card, never a row): date, score out of 20, worked out from the exam's answers as the
  results page does, and Passed or Not passed, each linking to its results.
- A link to Flagged with the number of flags (in Portuguese, `Assinalações (N)`).

### 6.7 Flagged

At `/flagged`: every flag, newest first, with the question number, English or Hint, the
note, and the question's Portuguese stem; a tap clears one flag once it is fixed. Copy
puts the list on the clipboard as plain text: a header line `Caçador flags
<YYYY-MM-DD>` with the date of the tap, then one line per flag, `#<id> English: <note>`
or `#<id> Hint: <note>`, the note part omitted when the note is empty. Share, shown only
where the browser has `navigator.share`, shares the same text, made at its tap too. A
clear that storage refuses shows the page's failure line in place of the list (§ 6.9).

The copied text is a machine format for an agent to read: the same English in every
interface language, its labels constants in one module, and the one exception to the
rule that components hold no user-facing text (§ 8.3). Flags stay on the device and
travel in the export (§ 7). The app writes nothing back to the data files and no script
applies a flag: Ross pastes the list to an agent, and a fix is a bead of its own. The
app never sets a translation's or a hint's `status` to `reviewed`, which stays in the
shape unused (§ 5 step 2 rule 10).

### 6.8 Settings

At `/settings`: the language, English or Português (§ 6.1); Export, which downloads the
progress file (§ 7); Share, shown only where the browser's share sheet takes a file
(`navigator.canShare`), which hands the same file as Export to the share sheet, made
at the tap with what the device holds and that day's date (it is started on the press,
so the share still falls inside the tap); Import, which merges a progress file and
reports the counts of answers, exams and flags added, or refuses a file that is not a
Caçador export; Clear progress, behind a confirm, which empties every store, the
no-repeat window and the words pass and keeps the language; a line saying progress
is not being saved on this device when storage is unavailable (§ 6.9); and a link to
Flagged.

### 6.9 Empty and failure states

- **A fresh device**: Home shows 33 % and 506 unseen, no exam card and no Weakest
  topics; Progress shows
  empty day bars, every list row not started and no past exams; Flagged says there are
  no flags, and Copy is disabled.
- **Storage unavailable**: when IndexedDB cannot be opened (a private window, blocked
  site data), the app runs on progress kept in memory for the visit, and Settings says
  progress is not being saved on this device. When localStorage is blocked, the
  language choice holds for the visit only, and the storage module keeps the words
  pass in memory for the page (§ 6.11); when sessionStorage is blocked, it keeps the
  no-repeat window in memory for the page. Clear progress empties both memory copies
  too. A stored pass or window that is garbled reads as none: the window starts empty
  and the drill starts a fresh pass. The words drill has no failure line, since
  nothing it reads or writes can be refused.
- **A read or write that fails**: when the storage module rejects, the screen says so in
  one plain line, instead of loading for good or going on as if the write had landed:
  - a failed read: Home, Practice, Exam, Progress and Flagged show the line in place of
    their content;
  - Practice: an answer whose write fails keeps its result on screen, the line says the
    answer was not saved and does not count, and Next still draws;
  - the flags row: a failed write says so in the row's own line and the row goes back
    to what is stored, keeping an open note field and its draft; while the row's flags
    cannot be read, at first or after a failed write, it says so and keeps its buttons
    disabled;
  - the exam: a Start that fails says so under Start. The running exam shows the line
    under the question and keeps its content: an answer that could not be saved is
    taken back to the answers stored, so what is on screen is what will be scored, and a
    Submit that could not finish stays on the exam, where Submit can be pressed again;
  - Flagged: a clear that fails shows the line in place of the list;
  - Settings: an export, share, import or clear that fails shows in its progress line.
- **A file that is not an export**: Import refuses anything that is not a version 1
  Caçador export, changes nothing, and says so.
- **An exam past its deadline**: settled as it stands at its deadline the next time
  progress is read (§ 6.5); it is never resumed and never shown as
  Home's card. A results address whose id is not a finished exam says so.
- **A pool smaller than the window**: the window shrinks to half the pool rounded down
  (§ 6.2), so the weights still act inside a small topic instead of a fixed rotation; a
  pool of one repeats its question. An unknown filter slug practises the whole bank.

### 6.10 Out of scope

Text-to-speech, a browse list of all 506 questions, links from a nudge's question
number, accounts or sync (export and import carry progress to a second device), and a
custom domain. For the words drill (§ 6.11): any record of how well a word is known
(a history, weighting by misses, a Progress line, an effect on readiness), English to
Portuguese, a choice of kind, and links between words and missed questions (cac-5y0).

### 6.11 Words

At `/words`, rounds of ten words from the bank's list (§ 3.3), each asking the English
for a Portuguese term, opened from Home's Words card (§ 6.3). The tab bar shows with no
tab current. The screen header takes its eyebrow form (§ 8.2): the eyebrow "Words" and
the counter "n of 10" in the right-hand slot, as a round's (§ 6.4).

- **The card**: the word's `pt` in Fraunces, its `phrase` under it, and three option
  rows lettered A, B, C in the question card's look (§ 8.6), each an English `en`. No
  peek, no Hint and no flags row.
- **The options**: the word's `en` and two others drawn at random from the words of the
  same kind whose `en` differs, ignoring case, from the right answer's and from each
  other; when the kind cannot supply two, the rest come from the whole list. The right
  answer's place among A, B, C is random. The draw takes a random source as the study
  model's draws do (`model/random.ts`), so the tests and the e2e suite seed it.
- **Answering**: tap an option. At once the rows are marked Right and Wrong as the
  question card marks them (§ 8.6) and the options lock. Under them a moss-tint panel in
  the hint panel's look holds the word's `note`, when it has one, then "Question N"
  over the sentence: N is the first of the word's `ids` whose question holds the phrase
  (compared as § 3.3 says), and the sentence is that question's stem, or its stem
  followed by the option that holds the phrase, with the phrase set in Fraunces 600
  inside it; Portuguese, with no English. Then Next, or Finish on the tenth answer, a
  rust button as in Practice.
- **The round and the score**: a round is always ten words. Finish shows, in place of
  the card, a plate captioned "Round done" with the count right in Fraunces 64 px and
  "of 10 right", then the round's ten words in the order shown, each with its
  Portuguese and its English, the missed ones marked with a cross and "Missed" on clay
  with ink text (§ 8.5), and a rust "Another 10" that starts the next round on the same
  screen; the header reads "10 of 10". Nothing about words is recorded: no answer log,
  no question state, nothing on Progress, Home's readiness or Weakest topics.
- **The pass**: the words come from one shuffled pass over every word, all kinds mixed,
  each round taking the next unanswered words of the pass. A word is spent when it is
  answered, right or wrong, so a missed word waits for the next pass. A spent pass
  reshuffles, and a round never shows a word twice, a reshuffle mid-round included.
  Words an update adds join the unseen part of the current pass; words it removes are
  skipped; a garbled stored pass starts a fresh one. The place in the pass is kept on
  the device (`cacador.words`, § 7) and never shown.
- **Leaving mid-round**: as in Practice (§ 6.4), the round's count lives on the screen,
  so leaving the page or reloading it ends the round. The next round opens at "1 of
  10" on the first unanswered word of the pass; the words already answered stay spent.
  Another 10 carries on from the same place.
- **Language**: the drill's own words (the header, the prompts, Next, Finish, the score
  plate and Home's card) follow the interface language through the English and pt-PT
  message files, the screen's own two and Home's ("Palavras", "1 de 10"). The word,
  its phrase and the sentence are Portuguese, and the options and the note English, in
  either interface language.
- **Laptop keys**, as Practice's (§ 6.4): A, B, C and 1, 2, 3 answer; Enter advances,
  or finishes on the tenth; Space is unbound, since there is no peek. The keys act from
  the page and the dock, never from the back control or the tab bar, and Enter on a
  focused button activates that button.

## 7. On-device storage

One storage module, `apps/web/src/storage/`, is the only code that imports `idb` or
touches IndexedDB; every screen records and reads progress through it. Database
`cacador`, version 1, four stores:

| Store | Key | Indexes | Holds |
| --- | --- | --- | --- |
| `answers` | `id`, auto-incremented | `questionId`, `at` | one Answer per answer, append-only but for an import that replaces an exam (below) |
| `questionState` | `questionId` | | one QuestionState per question seen, derived |
| `exams` | `id` | | one Exam per mock exam |
| `flags` | `[questionId, kind]` | | one Flag per question and kind |

The record shapes are the types in `apps/web/src/storage/types.ts`; every time is
milliseconds since the epoch:

```ts
Answer        { id?: number, questionId: number, at: number, chosen?: "A" | "B" | "C",
                correct: boolean, mode: "practice" | "exam", examId?: string }
QuestionState { questionId: number, attempts: number, correct: number, streak: number,
                recent: boolean[], lastSeenAt: number }
Exam          { id: string, startedAt: number, questionIds: number[],
                answers: Record<questionId, "A" | "B" | "C">, finishedAt?: number, score?: number }
Flag          { questionId: number, kind: "translation" | "hint", note: string, at: number }
```

- An Answer's `id` is assigned by IndexedDB on insert. `chosen` is absent only for an
  exam question left unanswered; `examId` is set on an exam answer, and only on an exam
  answer; a practice answer always has `chosen`. Recording an answer, or importing one,
  that breaks this is refused.
- A QuestionState's `correct` counts the right attempts; `streak` is the right answers
  in a row up to the last answer, 0 after a wrong one; `recent` holds the last three
  answers, right or wrong, newest last, which is all readiness needs without reading
  the log. It holds no weight: the weight is computed at draw time (§ 6.2).
- An Exam's `id` is a random string made when it starts, so exams from two devices never
  share an id and import can merge them by it. `questionIds` holds the 20 questions in
  order; `answers` has no entry for a question not answered. `finishedAt` and `score`
  (right answers out of 20) are set when it is finished; an exam without them is
  unfinished.
- A Flag's `at` is when it was set or its note last saved.

The shapes are never widened inside a bead; a change to them is a change to this
section first.

**Derived state.** Recording an answer appends it to `answers` and updates its
question's state in the same transaction. The question state is a cache of the log: it
is always derivable from `answers`, import rebuilds it from the merged log, and it is
never exported.

**Exams.** A running exam's answers are saved one question at a time, merged into the
stored record; the module refuses the change, and reports that it did, once the exam is
finished, when the moment the option was chosen is past its deadline, or for a question
not in the exam. Starting an exam while one is running saves nothing and returns the
running one. Finishing an exam is conditional: the module finishes it only while it is
still unfinished and reports whether it did, and the exam's answers are logged only when
it did, so Submit runs once. The finish time is held to the deadline: it is the earlier
of the moment of finishing and the start time plus 30 minutes, and never before the
start time, so an auto-submit that fires late and the settling of a stale exam both land
on the deadline. Every read of progress (the states, the log, the exams, an exam by id,
the export and the unfinished exam) first settles any exam past its deadline: finished
as it stands, with `finishedAt` and every logged answer's `at` equal to the deadline and
each unanswered question logged with no `chosen` and `correct` false. The deadline and
the score come from the study model (`apps/web/src/model/`), which the storage module
imports.

**Flags.** Setting a flag that exists replaces its note and time; clearing removes it.

**Persistence.** The module requests `navigator.storage.persist()` the first time it
opens the database.

**Memory fallback.** When IndexedDB cannot be opened, the module serves the same API
from memory, export, import and clear included, and reports that it is doing so; Settings
shows that progress is not being saved on this device (§ 6.9). The module's tests run on
fake-indexeddb.

**Web Storage.** Three keys, each starting `cacador.`, their names exported from
`apps/web/src/storage/keys.ts` for the screens to import:

- localStorage `cacador.locale`: the interface language, `en` or `pt`.
- localStorage `cacador.words`: the words drill's shuffled pass and the place in it
  (§ 6.11). The storage module owns it beside the no-repeat window and keeps it as
  `apps/web/src/storage/recent.ts` keeps the window: in memory for the page when
  localStorage is blocked, and a garbled stored pass reads as none, so a fresh pass
  starts. Clear progress removes it and its memory copy. It is not in IndexedDB, because
  a new store would bump the database version and change `storage/types.ts` for one
  small list, and it is not in the export, because the pass is a place, not progress.
  Nothing else goes in localStorage: no theme (the system setting decides) and no last
  mode.
- sessionStorage `cacador.recent`: the recent list the no-repeat window reads, the ten
  most recently drawn question ids as a JSON array, oldest first (§ 6.2). The storage
  module keeps it (`apps/web/src/storage/recent.ts`), in memory for the page when
  sessionStorage is blocked, and Clear progress empties it, the memory copy included.

**Export.** One JSON file, `cacador-progress-<YYYY-MM-DD>.json`, holding every store
but `questionState`, each as an array of its records:

```json
{ "app": "cacador", "version": 1, "exportedAt": 1791883800000,
  "answers": [], "exams": [], "flags": [] }
```

**Import.** It validates the shape and refuses anything that is not a version 1 Caçador
export without changing anything. It also refuses, changing nothing, a file holding a
record the app never writes: an exam that is not 20 distinct bank questions, an exam
whose `answers` name a question outside it, a finished exam without a score or a score
without `finishedAt`, a question id outside the bank, an answer breaking the `chosen`
and `examId` rule above, an exam answer whose exam is not finished in the same file, any
time more than five minutes after the import's moment, or a `finishedAt` before
`startedAt` or after `startedAt` plus 30 minutes. An answer's `correct` and a finished
exam's `score` are worked out again from the bank's key, not taken from the file.
Otherwise it merges:

- answers by `(questionId, at)`;
- exams by `id`: a finished copy wins over an unfinished one; between two finished
  copies the one with the earlier `finishedAt` stays; between two unfinished copies the
  one with more answers stays, the device's own on a tie;
- flags by `(questionId, kind)`, the newer kept.

An exam's logged answers follow the copy kept. When the file's copy replaces one the
device holds, the device's logged answers for that exam id are removed and the file's
come in; when the device's copy stays, the file's answers to that exam are left out.
This is the one place the answers log is not append-only, and it keeps one exam from
counting twice in the question states and the day bars.

When the merge leaves more than one exam unfinished, only the most recently started
stays unfinished and the others are submitted as they stand at the moment of the
import, held to the deadline rule above. Every question state is then rebuilt from the
merged log, and the counts of answers, exams and flags added are reported.

**Clear progress** asks first, then empties every store and removes `cacador.recent`
and `cacador.words`, and empties their memory copies when Web Storage is blocked; it
never touches `cacador.locale`.

## 8. Stack and conventions

Mirrors Sumit (`/Users/ross.lote/Projects/personal/mathracer/mathracer`), the
precedent for every choice here, minus the server: this app has no backend.

- pnpm workspace, Node 26 (`.nvmrc`), pnpm 11 pinned in `packageManager`, Corepack not
  used, `minimumReleaseAge: 4320` with no exclusions. `pnpm-workspace.yaml` lists
  `packages/*`, `apps/*` and `e2e` and sets `allowBuilds: {}`: no dependency runs an
  install script (Vite 8 bundles with Rolldown and no esbuild is installed).
- `packages/data` (`@cacador/data`): the bank, § 3 and § 4.
- `apps/web` (`@cacador/web`): Vite 8, React 19, TypeScript, Tailwind v4 through
  `@tailwindcss/vite`, react-router 7 (as Sumit pins it, not 8) with `BrowserRouter`,
  shadcn/ui on Base UI (`@base-ui/react`) with lucide icons, `idb` and vite-plugin-pwa
  2.0.0; vitest with jsdom, Testing Library and fake-indexeddb. workbox-window is not a
  dependency: the worker is registered by hand (§ 8.8).
  Scripts `dev`, `build`, `preview`, `typecheck` and `test`.
- `e2e` (`@cacador/e2e`): Playwright (`@playwright/test`), with `@cacador/data` for the
  bank the specs read. Scripts `e2e`, `browsers` (`playwright install chromium`) and
  `typecheck`, no `test` (§ 8.10).
- Root scripts: `pnpm dev` and `pnpm build` run apps/web's; `pnpm lint` is
  `eslint . --max-warnings 0`, then `tsc` in every workspace (`pnpm -r typecheck`), then
  the data validator (`pnpm validate`), then the Radix check
  (`node scripts/check-no-radix.mjs`); `pnpm test` is vitest in every workspace with a
  `test` script (packages/data and apps/web); `pnpm e2e` runs the Playwright suite and
  `pnpm e2e:browsers` installs its Chromium, once before the first run and after each
  Playwright bump;
  `pnpm extract` and `pnpm validate` are packages/data's. A bead is done when its
  acceptance holds and `pnpm lint` and `pnpm test` are green.
- Radix is banned. Two checks run inside `pnpm lint`, copied from Sumit: ESLint's
  `no-restricted-imports` rejects `@radix-ui/*`, `radix-ui` and `radix-ui/*` in
  `apps/web`, and `scripts/check-no-radix.mjs` fails when `pnpm-lock.yaml` or
  `apps/web/components.json` mentions radix in any case, or when `components.json` does
  not record a Base UI style.
- No pull requests and no recorded walkthroughs: this is a personal project (decision
  2026-10-13). Work is committed to `main`, and the push to `main` is the deploy
  (§ 8.9).

### 8.1 Layout

```
design/campo/              the design reference (§ 8.5): README.md, style-tile.html and one
                           artboard per screen, home.html, practice.html, exam.html and
                           progress.html; read for values, never built or served
apps/web/
  index.html               lang en, color-scheme light dark, the manifest and icon links, #root
  vite.config.ts           base /cacador/, React, Tailwind, the 404.html copy, vite-plugin-pwa
                           (the precache, the four font files included), the vitest settings
  components.json          shadcn: style base-nova, lucide icons (its base colour is
                           overridden by the Campo tokens in index.css)
  scripts/render-icons.sh  renders every PNG icon from public/favicon.svg
  public/                  manifest.webmanifest, favicon.svg, favicon-32.png,
                           apple-touch-icon.png, icons/ (192, 512, maskable 512)
  src/
    main.tsx               BrowserRouter with basename import.meta.env.BASE_URL, the image
                           map imported, the service worker registered
    App.tsx                the routes and the shared Layout around every page
    index.css              Tailwind, the Campo tokens light and dark mapped onto the shadcn
                           tokens, the @font-face rules of the two fonts
    home/                  HomePage: the header with the Settings control, the readiness
                           plate, the exam-in-progress card, the Quick 10, Words,
                           Practice and Exam cards, Weakest topics
    practice/              PracticePage and PracticeSession, FlagsRow, usePracticePool (the
                           query filter and its chip), recent.ts (the draw over the recent
                           list)
    exam/                  ExamPage (the sub-routes), ExamStart (start or resume),
                           RunningExam with ExamMarkers and useExamClock, ExamResultsPage
                           (the score and the review)
    progress/              ProgressPage, DayBars, GroupTabs and groups.ts (the three lists'
                           rows), PastExams, useDayRefresh (the read again at midnight and
                           when shown)
    settings/              SettingsPage, progressFile.ts (the download and the share sheet)
    flagged/               FlaggedPage, FlaggedLink (the row linking to Flagged at the foot
                           of Progress and Settings), copyFormat.ts (the fixed copy text,
                           § 6.7)
    words/                 the words drill (§ 6.11): its page, the round of ten, the
                           panel after answering and the score plate
    notfound/              NotFoundPage, for any address that names no screen
    components/nav/        the tab bar, on every screen but the /exam route, the screen
                           header with the back control, on every screen but Home, and
                           dock.ts (the dock over the tab bar and the footer's scroll
                           padding, § 8.2)
    components/question/   QuestionCard with PeekButton and HintPanel, OptionList (the
                           lettered option rows, shared with the words card), useAnswerKeys
                           (the laptop keys, shared by Practice and the words drill),
                           names.ts (a name in the interface language)
    components/round/      RoundCounter (the "n of 10" in the screen header) and
                           RoundSummary (the score plate), shared by Practice's round and
                           the words drill
    components/LinkButton.tsx  a router link drawn as a button
    components/FailureLine.tsx the one line a screen uses to say something did not work
    components/styles.ts   the shared class strings (§ 8.5): FOCUS_RING (the keyboard focus
                           ring), PLATE (a plate's box), CHIP (the flag and language chips),
                           ROW_LINK (a card row that links somewhere) and the MOSS_PANEL
                           strings (the hint panel's look, shared with the words panel)
    components/ui/         the 11 generated shadcn components
    model/                 the study model: draw.ts (weights, window, recent list), states.ts,
                           progress.ts (readiness, group accuracy, day bars), pools.ts,
                           groups.ts (the topics, sections and patterns with their pools),
                           exam.ts (draw, deadline, score), random.ts, dates.ts, and the
                           words drill's options draw (§ 6.11)
    storage/               the storage module: index.ts (the API), backend.ts with
                           idbBackend.ts and memoryBackend.ts, state.ts (the derived state),
                           finish.ts (the exam finish), merge.ts (the import merge),
                           exportFile.ts, keys.ts, types.ts, recent.ts (the no-repeat
                           window in sessionStorage, kept in memory when that is
                           blocked), and beside it the words pass in localStorage (§ 7)
    pwa/                   images.ts (the image map), registerServiceWorker.ts,
                           ReloadOnUpdate.tsx (the reload at the next change of screen)
    i18n/                  locales.ts, locale.ts (the store), useI18n.ts, messages/en/ and pt/
    lib/                   utils.ts (the cn helper the shadcn components use), useLoaded.ts
                           (a screen's read of storage), isOneOf.ts (the closed-set type
                           guard)
  test/                    setup.ts (jest-dom, fake-indexeddb, the resets before each test),
                           fixtures.ts (bank lookups the tests share), storage.ts (storage
                           set-ups the tests share: exam answers saved, IndexedDB made to
                           fail)
e2e/
  package.json             @cacador/e2e, scripts e2e, browsers and typecheck
  playwright.config.ts     the production build under vite preview, locale en-GB
  tsconfig.json
  look.ts                  the Campo colour values, the contrast helper, the colour a text
                           sits on, the Fraunces check
  app.ts                   the pieces the specs find by their words, the seeded Math.random
                           and the round counter
  round.spec.ts            a round of ten from Home's Quick 10 card to the score and Another 10
  acceptance.spec.ts       steps 2 to 9 of the Campo acceptance bar, in order, then four
                           steps after the bar
  words.spec.ts            steps 2 to 9 of the words bar (epic cac-zqe), in order, the
                           words read from @cacador/data at run time
  offline.spec.ts          step 10 of both bars: Home, Practice, Words, Fraunces and the
                           15 images from the cache, offline
  installable.spec.ts      the manifest and icons under /cacador/, Chrome's installability check
  build-output.spec.ts     the built dist: the 404.html copy, the worker that skips
                           waiting, the /cacador/ precache and URLs, and step 11 (four
                           woff2, 15 jpg)
  update.spec.ts           a deploy under an open page reaches it at the next change of
                           screen, never on the screen in use
```

The study model holds the formulas of § 6.2 and the exam draw, deadline and score, as
plain functions; the storage module holds § 7. Screens import both and never IndexedDB.

### 8.2 Routes

Under the basename `/cacador/`, taken from Vite's `base` through
`import.meta.env.BASE_URL`: `/` Home, `/practice` (query `topic`, `section` or
`pattern`, and `round` for a round of n questions, § 6.4), `/exam/*` registered as a splat so the exam folder owns its
sub-routes (`/exam`, which offers Start or resumes the unfinished exam and runs it in
place, and `/exam/results/<id>`, the results and review), `/progress` (query `tab`,
`section` or `pattern`, the open list, § 6.6), `/words` (the words drill, § 6.11),
`/settings` and `/flagged`. Any other
address, an unknown one under `/exam/` included, shows a not-found page inside the
`Layout`, with the back control to Home. Each page lives in `apps/web/src/<screen>/`.

The menu is the tab bar along the bottom (§ 6.3): Home, Practice, Exam and Progress, the
labels the navigation words of `common`, the current tab in forest with a filled icon
and `aria-current="page"`. It shows on every route except `/exam` itself, the start
screen and the running exam; the results route, `/words`, `/settings`, `/flagged` and
the not-found page show it with no tab current. The bar sits in the layout's footer,
sticky at the foot of the viewport at the end of the column, so it takes its own room
under the content: first the dock, a slot a screen portals into for the controls that
must not move (Practice's Hold for English and Hint, § 8.6), empty elsewhere, then the
tab bar. The root's bottom scroll padding follows the footer's height, so a scroll into
view stops above it. Every screen but Home opens with one screen header row: the back
control to Home (a left arrow, accessible name "Back to Home"), then the caption, and a
slot at the right. The caption takes one of two forms:

- **Eyebrow**, on Practice, the exam's screens and Words: an eyebrow (the section ·
  topic on Practice, "Exam" on the exam) over a muted line in Fraunces 16 px (the
  question number on Practice, "n of 20" on the running exam; none on the start screen
  and the results), with the page's h1 ("Practice", "Exam") for screen readers only. The
  clock sits in the slot on the running exam. The results page sets its visible h1,
  "Exam results", in Fraunces 28 px under the row. Words takes the eyebrow form too: the
  eyebrow "Words", no line, and the counter "n of 10" in the slot as a round's (§ 6.4,
  § 6.11).
- **Title**, on Progress, Settings, Flagged and the not-found page: the screen's name
  as the visible h1 in Fraunces 28 px, with no eyebrow and no line. Progress puts
  "N % · M unseen" in the slot at the right, the percentage in Fraunces 26 px and the
  unseen count in muted 13 px.

Home's header is the app name with the Settings control at its right. The tab bar and
the screen header are shared pieces in `apps/web/src/components/nav/`; each page
renders its own header, so its own data can sit in it.

### 8.3 Messages

No user-facing text in components; strings live in the message files, English and
European Portuguese (`pt-PT`, never Brazilian). `apps/web/src/i18n/messages/en/` and
`pt/` each hold `common`, `home`, `practice`, `exam`, `progress`, `settings`, `flagged`
and `words` `.ts` files. The English index defines the `Messages` type and each
Portuguese file is typed by its English counterpart, so a key missing on either side
fails `pnpm lint`. `common` holds the app name, the navigation labels (Home included,
for the back control) and the not-found page's two strings, and belongs to the scaffold.
A screen's bead edits only its own two files and duplicates a shared word rather than
editing `common`. The language store is a module-level store in `i18n/locale.ts` read by
`useI18n()`, which returns `t`, as in Sumit. The one exception to the no-text rule is
the Flagged page's copy format (§ 6.7), constants in one module and never message keys.

### 8.4 Hot files

A file every bead would touch makes beads serial, so the scaffold owns the shared files
and no bead running beside others edits them: the root `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `eslint.config.js`, `.gitignore`,
`scripts/check-no-radix.mjs`, `e2e/package.json`, and in `apps/web` the `package.json`,
`components.json`, `tsconfig.json`, `src/App.tsx`, `src/index.css`,
`src/components/ui/**`, the i18n store and index files (`locales.ts`, `locale.ts`,
`useI18n.ts` and the three message indexes) and `src/storage/types.ts`. A change to one
of them is a bead or pass of its own that names the file in its TOUCHES while no other
worker holds it, never an edit outside a bead's files; so is a new dependency, because
it changes the lockfile. A new screen gets its own folder, its own two message files and
a route added by such a bead, because `App.tsx` is a hot file. A bead's size cap of about
a thousand lines does not count `pnpm-lock.yaml` or the generated shadcn components.

In phase 4 the scaffold (cac-eil.2) installed the dependencies, each in the workspace it
belongs to (`apps/web` the app, shadcn and its components, `idb`, the PWA plugin and the
test tools; the root `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`;
`e2e` `@playwright/test`). After it, the PWA bead (cac-eil.5) edited
`apps/web/vite.config.ts`, `index.html` and `src/main.tsx`; the end-of-epic simplify
pass, run alone, narrowed the vitest include in `vite.config.ts`, removed workbox-window
from `apps/web` (§ 8.8), added `@cacador/data` to `e2e` and touched `eslint.config.js`,
`src/storage/types.ts` and the lockfile; and the review fixes added the browser install
script to the root and `e2e` package files and the not-found route to `App.tsx` and
`common`, each batch holding those files alone.

In phase 5 (epic cac-zqe) each shared file has one bead: the scaffolding bead
(cac-zqe.2) alone edits `packages/data/src/index.ts`, `packages/data/scripts/**` and
`packages/data/test/**`; the storage and model bead (cac-zqe.3) alone edits
`apps/web/src/storage/**`, `keys.ts` the hot one, and `apps/web/src/model/**`; the
screen bead (cac-zqe.4) alone edits `src/App.tsx` and the English and Portuguese
message indexes; `e2e/**` and `CLAUDE.md` belong to the e2e bead (cac-zqe.20). The
phase adds no dependency, so the lockfile and every `package.json` stay as they are.

### 8.5 Look

Campo, design direction 1 (epic cac-8cn): a field notebook. A warm paper ground, ink
text, forest green as the working colour (tabs, right answers, bars), rust for the one
thing to do next and for a wrong answer, hairlines and plates, no shadows. The
reference is `design/campo/`: the style tile and one artboard each for Home, Practice,
the exam and Progress, read for their values; where a file and this section disagree,
this section wins. Settings, Flagged and the not-found page have no artboard and follow
the style tile's rules.

**Palette.** The theme follows `prefers-color-scheme`, light and dark both rendered: the
dark tokens and Tailwind's `dark:` variant are keyed on the media query, never on a
class, and there is no toggle (Sumit's dark-only `index.css`, class-keyed variant and
Google Fonts are not the precedent here). Dark is the same notebook by lamplight.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| paper | `#F4F0E6` | `#151A17` | the ground |
| card | `#FBF8F1` | `#1C2320` | cards, plates, rows |
| line | `#D9D2C2` | `#33403A` | hairlines |
| track | `#E6E0D2` | `#2A332D` | the empty part of a bar |
| ink | `#1C2620` | `#EDE8DB` | text |
| muted | `#5A6256` | `#B3BAAE` | secondary text |
| eyebrow | `#4F6650` | `#9DBAA2` | section and topic captions |
| forest | `#2E5A3A` | `#7FB58C` | the working colour |
| moss tint | `#DDE8DA` | `#243A2C` | the right answer, the hint panel |
| moss line | `#B9C9B6` | `#3A5543` | the hint panel's rule |
| rust | `#B5461C` | `#E0784F` | the next thing to do, a wrong answer |
| clay tint | `#F3DED2` | `#3E2419` | the wrong answer, the exam in progress |

Text on a forest or rust fill is the card colour in light and the ground in dark. The
contrast rule: every text colour passes 4.5:1 against the colour it sits on (3:1 at
24 px and above), in both themes; a change to a value, or a new pairing, is checked
against it before it lands. Text on the clay tint is ink, never rust, in both themes:
the Not passed chip (clay with ink text and a rust hairline), the word "Wrong" on the
chosen wrong row and the text of Home's exam-in-progress card. Rust appears on clay
only as the hairline, the rust-filled letter (card text on rust, 5.13:1) and the icon
(not text, 3:1). The Passed chip is moss tint with forest text. The shadcn tokens map
onto these: background paper, card card, border line, foreground ink, muted-foreground
muted, primary rust, secondary card with the ink hairline, accent moss tint, destructive
rust, success forest and ring forest. The paper ground is the one cream the app allows,
by Ross's choice (2026-10-14).

**Type.** Two fonts. Fraunces, variable on the opsz and wght axes, at weight 600, for
the app name, the screen titles, the question stem, every number that is the point of
its screen (readiness, the clock, percentages, scores) and the option letters. Progress's
"Today: N answers, M right" is a secondary line in Source Sans, beside its plate's
eyebrow. Source Sans 3, variable on wght, for everything else: body 16 to 17 px,
secondary 13 to 14 px, eyebrows 12 px uppercase with 0.14em tracking at 600, the way a
plate is captioned. Both are self-hosted from `@fontsource-variable/fraunces` and
`@fontsource-variable/source-sans-3`, upright only, the latin and latin-ext subsets
only, declared by the app's own `@font-face` rules in `index.css` under the family names
"Fraunces" and "Source Sans 3" with `font-display: swap` over the system stack. The
build therefore carries exactly four woff2 files, about 220 KB: Fraunces latin and
latin-ext (the opsz files, which carry the wght axis too) and Source Sans 3 latin and
latin-ext (the wght files). All four are in the precache (§ 8.8), so the fonts work
offline and never fall back after the first visit. Google Fonts, or any font host, is
never linked.

**Shape.** Corners 6 px (chips, markers, badges), 8 px (controls and rows) and 10 px
(cards and plates); 1 px hairlines in the line colour; no shadows and no gradients.
Every touch target is at least 44 px. The page gutter is 20 px, and the column is
phone-first, `max-w-2xl`, and also works at laptop width.

**Icons** are lucide at stroke 1.75, never emoji: house, target, timer and
chart-no-axes-column for the four tabs, sliders-horizontal for Settings, flag,
languages (Hold for English), lightbulb (Hint), check, x, chevron-right and arrow-left
(the back control).

**Exclusions** on every screen: no pill buttons, no "01 / 02 / 03" section labels, no
italic accent words, no gradient hero, no chart library (the day bars are plain blocks),
and no cream beyond the paper ground.

### 8.6 The question card

The stem, picture, options, peek, result marking and hint panel live in one card under
`apps/web/src/components/question/`, a controlled component. The page tells it which
option is selected, whether the result is revealed (the chosen option marked right or
wrong and the correct one marked, the correct one marked even when nothing is
selected), whether the options are locked, and whether peek and hint are enabled. The
card records nothing and handles no keys. Practice reveals on tap; the running exam
shows the selection with nothing revealed and peek and hint off; the exam review shows
it revealed with peek and hint on.

Its look (§ 8.5):

- **The picture plate.** A question's picture sits whole on a plate (card, 8 px padding,
  hairline, 10 px corners), centred, at most 240 px tall, and is never cropped: the
  species must be identifiable, and the bank's pictures are small.
- **The stem** is Fraunces 24 px.
- **The options** are rows (card, hairline, 8 px corners), each with its letter in a
  28 px circle outlined in ink, in Fraunces 15 px.
- **Revealed**: the correct row turns moss tint with a forest hairline, its letter
  filled forest, with a tick and the word "Right"; the chosen wrong row turns clay tint
  with a rust hairline, its letter filled rust, with a cross and the word "Wrong" in
  ink (§ 8.5). The other rows stay as they were. In the exam review an unanswered
  question carries "Not answered" above it and only its correct row marked.
- **Unrevealed**: an untouched row is the plain row; the exam's chosen row is filled ink
  with card-coloured text and a card-outlined letter.
- **Peek and Hint** sit in one row, "Hold for English" (three fifths, card with an ink
  hairline, languages icon, inverted to ink with card text while held) and "Hint" (two
  fifths, card, hairline, lightbulb icon), never under the text a peek changes. In
  Practice the card docks them: the row sits in the layout's dock on a paper strip under
  a hairline, at the 20 px gutter, directly over the tab bar (§ 8.2). In the exam review
  each card opens with its own row, under the place line and over the picture and the
  stem.
- **The hint panel** follows the options and is scrolled into view as it opens. It is a
  moss-tint block with no border and 10 px corners: the eyebrows
  "Language notes" and "Nudge" in forest, each note's Portuguese phrase in Fraunces 600,
  a middle dot and its English in the eyebrow colour, then the note; the nudge sits
  under a moss-line rule.

Outside the card, Practice's flags row reads "Report:" in muted before two chips (card,
hairline, 6 px corners, 36 px tall, flag icon), and Next is a rust button with a
chevron.

### 8.7 Data and images

`@cacador/data` is a workspace dependency imported as is: questions, translations,
hints, patterns and manifest in one bundle, about 109 KB gzipped, with no lazy loading,
and the loader unchanged. The 15 images reach the bundle through one image map under
`apps/web/src/pwa/`: every file under `@cacador/data/images` imported as a URL, and an
`imageUrl(file)` lookup that every screen uses. Vite emits an asset only when a module
imports it, so the map puts the jpgs in `dist` and in the precache whatever the screens
do; nothing copies them into `public/`.

### 8.8 Installable and offline

vite-plugin-pwa 2.0.0 in `generateSW` mode precaches everything in `dist`, the jpg
assets, the four font files (§ 8.5) and the manifest included, with scope `/cacador/`.
A new service worker installs in the background and takes over the open pages as soon
as it has installed (`skipWaiting` and `clientsClaim`, set in the workbox options because
the plugin's `registerType: 'autoUpdate'` sets them only when it injects the
registration). The page then reloads itself at the learner's next change of screen (a
tab, a card, the back control: a change of the router's pathname), never on the screen
in use, and no prompt is shown. The first worker claiming a page that loaded without one
is not an update and reloads nothing. The browser checks for a new worker when the app
is opened; the page also asks for one each time the app comes back to the foreground,
because an installed app resumed from the background loads nothing.

The worker is registered by hand: `main.tsx` calls `registerServiceWorker()` from
`apps/web/src/pwa/registerServiceWorker.ts`, which, in a production build and in a
browser with service workers, calls `navigator.serviceWorker.register` for `sw.js`
under the base with scope `/cacador/` after the page's `load` event, so the first
visit's precache downloads do not compete with the page's own requests. It notes when a
worker takes over a page another worker controlled, and calls the registration's
`update()` on each `visibilitychange` to visible (a failure offline is ignored);
`ReloadOnUpdate`, mounted beside the routes in `main.tsx`, reloads the page on the next
pathname change once that has happened. The plugin injects no registration
(`injectRegister: false`), and neither workbox-window nor `virtual:pwa-register` is
used: the update path is these few lines. The manifest: id,
`start_url` and scope `/cacador/`, name and short_name Caçador, display standalone,
lang en, background and theme colour `#14301f`. The icons are rendered from one
committed SVG, a flat mark of the letter Ç in off-white `#f2efe6` on dark green
`#14301f` (no cartoon, no photo, no gradient), at 192 px, 512 px and maskable 512 px,
plus a 32 px favicon, the SVG favicon and a 180 px apple-touch-icon, as Sumit's
`public/` has. The storage module requests persistent storage (§ 7). Ross studies on
Chrome on Android, which installs the app from its menu.

### 8.9 Hosting and deploy

The repository is public on GitHub as `RossLote/cacador`, and GitHub Pages serves
`apps/web/dist` at https://rosslote.github.io/cacador/. `.github/workflows/deploy.yml`
deploys on every push to `main`: install (Node from `.nvmrc`, pnpm from the root
`packageManager`, frozen lockfile), `pnpm lint`, `pnpm test`, `pnpm build`, then
configure Pages with the default `GITHUB_TOKEN` and no enablement step, upload `dist`
and deploy; e2e is not part of it. Ross enables Pages once by hand before the first
push (repository Settings, Pages, Source: GitHub Actions), because
`actions/configure-pages` can enable Pages only with a personal access token.

The app lives at the sub-path `/cacador/`: Vite's `base`, the manifest's id,
`start_url` and scope, the service worker's scope and the router's basename all carry
it. The build also writes `dist/404.html` as a copy of `index.html`, so a sub-route
loaded directly before the service worker controls the page still opens the app on
GitHub Pages. The remote serves code and Pages only; beads stay the committed JSONL with
no Dolt remote (§ 9).

### 8.10 End-to-end tests

The `e2e` workspace runs `@playwright/test` in Chromium against the production build:
its web server builds `apps/web` and serves it with `vite preview` on port 4173
(`E2E_PORT` overrides it, so two worktrees can run at once) under `/cacador/`, with the
browser locale `en-GB`. `pnpm e2e` at the root runs it; it is not part of `pnpm lint` or
`pnpm test`, so the gates stay fast. `pnpm e2e:browsers` installs Chromium for it, once
before the first run and again after each Playwright bump. The `e2e` script stays plain
`playwright test`, never `--pass-with-no-tests`. The specs import the bank from
`@cacador/data`. The viewport is 390 x 844 in `playwright.config.ts`, because epic
cac-8cn's Campo acceptance bar is performed at a phone's width. `look.ts` holds the
Campo colour values the colour checks read (light and dark, § 8.5), the WCAG contrast
helper and the check that an element is set in Fraunces and the face has loaded;
`app.ts` holds the pieces the specs find by their words (the screen header, the tab
bar, the question card, Practice's answer and Next, the words drill's card and the word
on it as its list entry). Seven spec files:

- `round.spec.ts` walks a round of ten (§ 6.4): Home's rust Quick 10 card the width of
  the column over the hairline Practice card, the counter in the header from "1 of 10"
  through every answer, Finish in place of the last Next, the score plate with the
  count right in Fraunces and Another 10, then the Practice tab with no counter and
  Next again;
- `acceptance.spec.ts` performs steps 2 to 9 of the Campo acceptance bar, in order,
  one named step each, in one fresh browser context, with the page's random draws seeded
  so every run draws the same questions: Home, the Practice tab, a wrong answer, the
  Progress tab, the Ducks row and Home's weakest topics with the unseen count, the exam
  through its results, the dark colours with their 4.5:1 contrast (the heading against
  the body, the unseen count and the pass line against the plate they sit on), and the
  language switch in Settings. Four steps after the bar run on the same state: an exam
  answered in full from the bank's key, 16 right, which shows Passed with only the wrong
  ones listed and is listed as Passed on Progress; an exam with answers that survives a
  closed tab with its clock running; the past exams on Progress with Flagged and its
  copy; and export, clear and import;
- `words.spec.ts` performs steps 2 to 9 of epic cac-zqe's words bar (§ 6.11), in order,
  one named step each, in one fresh browser context with the page's random draws
  seeded: Home's four start cards with Words under Quick 10; the drill's header, card and
  three options of the word's kind; a wrong answer with Right, Wrong, the locked rows and
  the panel's "Question N", sentence and note; the keys 2 and Enter; a round to Finish
  and the score plate with its ten rows and the misses; Another 10, Home and a reload
  never showing a word already answered; the drill in Português; and Clear progress
  removing `cacador.words` and keeping `cacador.locale`. The list keeps growing, so the
  spec pins nothing about it: it reads every word from `@cacador/data` at run time,
  finds the word on screen by its Portuguese and answers right by that entry's `en`;
- `offline.spec.ts` is step 10 of both bars: after one online load and a reload, Home,
  Practice and Words open offline with Fraunces available, Words with a word of the list
  and three options, and all 15 images answer from the cache;
- `installable.spec.ts`: the manifest and icons served under `/cacador/`, and Chrome's
  own installability check reporting no errors;
- `build-output.spec.ts` reads the built `dist` rather than the served pages, because
  `vite preview` answers any sub-route itself: `404.html` is a byte-for-byte copy of
  `index.html`, the service worker skips waiting and claims clients with no
  `SKIP_WAITING` listener, the precache holds every built file under `/cacador/`, and
  every URL in `index.html` starts with `/cacador/`. It also carries step 11: the
  precache holds exactly four woff2 URLs (Fraunces and Source Sans 3, latin and
  latin-ext) and the 15 jpg URLs, every URL under `/cacador/`, and no file served
  points at a font host;
- `update.spec.ts` deploys under an open page by rewriting `dist/sw.js` (vite preview
  reads `dist` from disk on each request) and restores it after: a change of screen
  before the update stays in the page, the new worker takes over after the app's
  foreground check without reloading Practice's question, the next change of screen
  loads the page again, and the one after that stays in it.

The orchestrator performs the other two steps of the bar by hand: step 1, a fresh clone
on Node 26 with `pnpm install`, `pnpm lint` and `pnpm test` green, and step 12, after
the epic's merge into `main` and its push: the deploy workflow run for that push green,
and the live site serving Home with the paper ground, the tab bar and the two fonts.
Of the words bar, the orchestrator performs step 1 (the fresh clone, with `pnpm
validate` printing a words line of 12 files and at least 700 words) and the Mac session
step 11 after its push (the deploy green and the live Home showing Words under Quick 10).

### 8.11 Agents

In phase 4 the Flagged page (cac-eil.8) and focused practice with the flags row
(cac-eil.14), which copied an existing page, ran on Sonnet; every other bead ran on Opus,
because each sets a pattern, owns hot files, carries the formulas, the schema or the
merge, or makes a screen judgement call.

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
  per-question state (§ 7); localStorage only for settings. One exception since epic
  cac-eil: an import that keeps the file's copy of an exam replaces the device's
  answers to it (below). Amended 2026-10-22 by epic cac-zqe: localStorage also holds
  the words pass, a place and not progress (below).
- **2026-10-13, No epic ceremony.** No pull requests, no recorded walkthrough; beads
  carry the plan, lint and tests carry the proof. The push to `main` is the deploy: a
  workflow runs the gates and publishes to GitHub Pages, with nothing to do beyond the
  push (amended by epic cac-eil, D1).
- **2026-10-22, The words drill ships by merge on the box.** No pull request and no
  recording; the committed e2e suite performs the epic's acceptance bar. The run ends
  with the epic branch merged into the home server's clone's local `main` and nothing
  pushed; the Mac finishes with `git pull --ff-only box main`, `pnpm lint`, `pnpm test`
  and `git push origin main`, the deploy, then checks the live site. Reason: No epic
  ceremony, above; the run is headless on the home server, and the push, which is the
  deploy, is made from the Mac (epic cac-zqe D18).
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
- **2026-10-13, No hand review in phase 2.** Every entry ends at `checked`. Reason:
  `reviewed` means Ross read the entry (§ 3.3), so only Ross's own study can set it
  (brief cac-qgb D6). Amended 2026-10-13 by epic cac-eil (D2): the app never sets
  `reviewed` either, and the status stays in the shape unused; what Ross finds while
  studying he flags on the device and pastes to an agent (§ 6.7).
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
- **2026-10-13, Language notes only where the reading changes.** A language note is
  written only for a word or construction that changes the reading of the sentence (só,
  desde que, não, a partir de, bem como, a false friend like única or processo), in the
  stem or in an option; never a vocabulary gloss the peek already gives; an empty list
  is right on a plain stem; at most four entries per question. Its `pt` is verbatim from
  the question or option (§ 4 rule 5), its `en` is the wording the translation uses for
  that phrase, its `note` gives the meaning. § 5 step 2 rule 11 carries over: a name
  under test is never glossed in a language note (§ 5 step 3 rules 2 to 4). Reason: 345
  of 506 stems carry no construction and the peek covers vocabulary (brief cac-bc2
  FOUND). Precedent: `hints/en/01-documentos.json`.
- **2026-10-13, A closed pattern list.** Pattern tags come from a closed list,
  `packages/data/hints/patterns.json`, an array of `{ slug, pt, en, note }`: `slug` the
  kebab-case tag hints use, unique; `pt` the construction as the bank prints it or a
  short Portuguese label when it has no single form; `en` the English name the app's
  report shows; `note` what the construction does to the reading and when to tag it
  (§ 3.3). Built from a sweep of the bank, about 20 entries and never more than 25; the
  validator (§ 4 rule 8) rejects a tag that is not a slug in it. A writer who needs a
  tag the list lacks leaves the question untagged and reports it in the close reason
  for the tail bead cac-eyh.24. Reason: the app reports accuracy per pattern, which
  needs a fixed vocabulary with enough questions each; the list § 3.3 used to give does
  not match the bank (brief cac-bc2 D2).
- **2026-10-13, The nudge is the fact and the contrast.** The nudge is never empty, at
  most two sentences, states the fact behind the keyed answer and what separates a
  near-miss distractor, quotes the Portuguese words that carry the fact, and never
  names the letter; an image question's nudge gives the species' distinguishing field
  marks (§ 5 step 3 rule 5). Reason: the app already marks the correct option; the
  nudge's job is the fact and the contrast (brief cac-bc2 D3).
- **2026-10-13, Nudges grounded in the bank.** A nudge asserts only what the bank itself
  and the two glossaries establish: no law citations, no article numbers, no
  recollection of the law beyond the keyed option. The checker narrows a nudge it
  cannot confirm to what the keyed option asserts (§ 5 step 3 rule 6). The one
  exception is an image question's field marks: where a species photo is the question,
  the nudge names the visible features a field guide gives for the keyed species
  (plumage, colouring, bill, shape, coat) and uses the bank's own Biology questions
  about that species where they describe it; the limit to the bank and the glossaries
  still binds every legal claim and every non-visual biological claim, and the four
  `sinal.jpg` questions, which are not species photos, state what the sign means only
  as their keyed answers establish it. Reason: no official manual exists and nothing in
  the repo verifies a recollection (brief cac-bc2 D4). Reason for the exception: the
  nudge decision asks for field marks and neither the bank's text nor the glossaries
  describe plumage, so a strict limit would empty every photo nudge; a visible feature
  is checkable against the photo itself, which a recollection of the law is not
  (orchestrator ruling, cac-eyh.1). The exception also lets a species-photo nudge name
  the distinguishing visible marks of the near-miss species in the options, because the
  nudge decision asks what separates the near miss and a plumage mark is checkable
  against any field guide, unlike a recollection of the law (orchestrator ruling,
  cac-eyh content review).
- **2026-10-13, Hint precedent.** `hints/en/01-documentos.json`, hand-written in the
  brief and read by Ross, is the precedent every writer and checker reads first; it
  goes through the checker's pass like any other file (§ 5 step 3 rule 1). Reason:
  brief cac-bc2 D5.
- **2026-10-13, Tag what the answer turns on.** A tag is applied only where the
  construction is part of what the answer turns on, not on every occurrence; in the
  precedent most entries carry no tag, and entry 3 carries none because the number
  decides (§ 5 step 3 rule 8). Reason: a low score on a pattern should mean that
  construction cost answers (brief cac-bc2 D6).
- **2026-10-13, Nudges may cite question numbers.** A nudge may cross-reference another
  question by number ("question 10 asks the same with rabbits"), with the fact always
  stated in words too (§ 5 step 3 rule 7). Reason: ids are stable, so the number finds
  the question (brief cac-bc2 D7). The app does not link the number: that is out of
  scope (§ 6.10, epic cac-eil D10).
- **2026-10-13, Grammar named only when it recurs.** A language note names the grammar
  briefly only when the form recurs across the bank (the future subjunctive after se,
  the present subjunctive after desde que); elsewhere it gives the meaning only (§ 5
  step 3 rule 3). Reason: brief cac-bc2 D8.
- **2026-10-13, Hint checker by a second agent.** The writer leaves every entry at
  `draft`. The checker is a different agent, never the writer of the same file: it
  reads the Portuguese, the English, the keyed answer and the hint side by side, fixes
  in place, and sets `status` to `checked`; from then § 4 rule 5 requires a non-empty
  `nudge`. Its fixes go in the bead's close reason with the ids; the hint shape has no
  `notes` field. No entry is set to `reviewed` in this phase, as in phase 2, and the
  app never sets it (§ 5 step 3 rule 9, amended by epic cac-eil D2). Reason: the phase 2 meaning pass and close-reason record (cac-qre D5 and D8)
  worked.
- **2026-10-13, Hint files scaffolded and wired once.** One bead scaffolds the 17
  missing hint files as empty `draft` entries (§ 4 rule 5 allows empty `language`,
  `nudge` and `patterns`) and wires all 18 into the loader once, so writer and checker
  beads own only their hint files and run in parallel; none of them edits
  `src/index.ts`, the scripts, the tests, `hints/patterns.json`, `translations/` or
  `questions/` (§ 5 step 3 rule 10). Reason: phase 2's loader hot file made its
  translation beads serial (cac-qre D9).
- **2026-10-13, Bead size for hints.** A bead owns the chunk files of one phase 2
  translation group (37 to 63 questions) and works them one file at a time; checker
  beads mirror the writer groups one to one; group 1's writer owns
  `02-conceitos-basicos.json` only, since `01-documentos.json` exists, and its checker
  owns both. Reason: agents work one chunk file at a time (`CLAUDE.md`, cac-qre D10).
- **2026-10-13, Hint beads run on Opus.** Writer and checker beads run on Opus: content
  judgement is not extraction work. The scaffolding bead, which copies the phase 2
  wiring and counts, runs on Sonnet.
- **2026-10-13, No positional tell in language notes.** A language note may sit on a
  phrase found only in the keyed option when another option also carries a note (the
  precedent's entry 5), but an entry whose option-level notes all sit on the keyed
  option singles it out before answering, so that note is moved to the near miss's
  matching phrase, matched there, or dropped (§ 5 step 3 rule 11). Chosen over
  allowing every keyed-only note and over banning them all (cac-eyh.17's first
  reading). Reason: notes are shown before answering and must not single out an
  option, while across the checked files distractors carry more notes (77) than keyed
  options (43), so no file-wide tell exists (orchestrator ruling, cac-eyh checker
  pass).
- **2026-10-13, Printed typos stay as printed.** A typo the official PDF itself prints
  stays in `questions/` as the exam prints it and is not reported as a Portuguese
  error: question 92 option C keeps 'a Sul o Tejo' and question 153 option A keeps
  'até ás' (§ 5 step 3 rule 12). Chosen over a correction-table fix to 'a Sul do
  Tejo'. Reason: the bank is reproduced as the exam prints it, the typo changes no
  reading (the translation says 'south of the Tejo'), and the correction table exists
  for extraction slips (orchestrator ruling, cac-eyh writer pass).
- **2026-10-13, Options named by their Portuguese, never by position.** A nudge refers
  to an option by its quoted Portuguese, never by its letter or its place in the list
  (§ 5 step 3 rule 13). Reason: the content review found nudges that picked out a
  distractor by its position, "the third option" in question 178 (fixed with 202 in
  cac-eyh.25); a position names the option just as the letter does, and the quote is
  what the nudge decision asks it to carry (cac-eyh content review).
- **2026-10-13, Hosted on GitHub Pages.** The repository is public as `RossLote/cacador`
  and GitHub Pages serves `apps/web/dist`, deployed by `.github/workflows/deploy.yml` on
  every push to `main` after install, lint, test and build, with the default token and
  no enablement step; Ross enables Pages once by hand (Source: GitHub Actions). The app
  lives at `/cacador/`, which Vite's base, the manifest, the service worker scope and
  the router basename all carry, and the build writes `dist/404.html` as a copy of
  `index.html`. The remote serves code and Pages only; beads stay the committed JSONL
  (§ 8.9). Reason: a commit is the deploy and the repo gains a backup; enabling Pages
  from the workflow would need a personal access token, and without the 404 copy a
  sub-route loaded before the service worker controls the page is GitHub's 404 (epic
  cac-eil D1; brief cac-aqy D1).
- **2026-10-13, Flags stay on the device.** After answering in practice, "English is
  off" and "Hint is off" create a flag with an optional one-line note; the Flagged page
  lists them with ids and copies them as fixed English plain text for an agent; nothing
  is written back to the data files, no script applies a flag, and the app never sets
  `reviewed` (§ 6.4, § 6.7). Reason: Ross wants no backend and no stored copy anywhere,
  only a page he can paste to an agent; the tap semantics and the practice-only rule
  are Ross's defaults on the epic review (epic cac-eil D2; brief cac-aqy D2).
- **2026-10-13, The exam runs as the real one.** 20 uniform questions, free movement,
  answers changeable until Submit, a 30-minute clock from the start time that keeps
  running while the app is closed, auto-submit at 30:00, no peek or Hint until the
  review; Submit runs once, an unanswered question is logged wrong with no chosen
  option, and an exam past its deadline is settled at its deadline whenever a screen
  asks for it (§ 6.5). Reason: the exam measures readiness; the once-only, unanswered
  and deadline rules came from the epic review, so a double tap or an exam left
  overnight cannot log twice or land on the wrong day (epic cac-eil D3; brief cac-aqy
  D3).
- **2026-10-13, Focused practice by query.** `/practice?topic=`, `?section=` or
  `?pattern=` limits the pool, a chip names it, an unknown slug means the whole bank,
  and the no-repeat window is one app-wide list in sessionStorage `cacador.recent`
  (§ 6.4). Reason: "ducks 55 %" is one tap from fixing (epic cac-eil D4; brief cac-aqy
  D4).
- **2026-10-13, Readiness and draw weights.** Readiness is the mean over 506 of each
  question's share right in its last three answers, an unseen question counting one
  third; weights are wrong last time 4, unseen 3, streak 1 → 2, 2 → 1, 3 or more → 0.5,
  computed at draw time and never stored; the no-repeat window is the smaller of ten
  and half the pool rounded down (§ 6.2). Reason: the score rises only by covering and
  holding the bank, and a wrong answer comes back soon without taking over; the
  half-pool window because 13 of the 29 topics have eleven questions or fewer and a
  window of pool minus one made them a fixed rotation (epic cac-eil D5, the window
  Ross's default on the epic review; brief cac-aqy D5).
- **2026-10-13, English interface first.** The interface is English on the first visit
  whatever the browser says, pt-PT is chosen in Settings and kept in localStorage
  `cacador.locale`, and `<html lang>` follows; a module store read by `useI18n()`, as in
  Sumit (§ 6.1, § 8.3). Reason: the learner reads English, and the strings rule already
  asks for both message files (epic cac-eil D6; brief cac-aqy D6).
- **2026-10-13, Plain look, light and dark.** The theme follows `prefers-color-scheme`
  with both rendered, shadcn/ui on Base UI style `base-nova` in neutral, phone-first
  single column, system fonts, no design canvas, and no cream backgrounds, pill
  buttons, numbered section labels, italic accent words, gradient hero or chart library
  (§ 8.5). Reason: no ceremony; the content is the product. Sumit's dark-only, class-keyed
  theme and Google Fonts are not the precedent, since offline needs nothing fetched
  (epic cac-eil D7; brief cac-aqy D7 and D12). Reversed 2026-10-14 by epic cac-8cn for
  the neutral base, the system fonts, the design canvas and the cream (the Campo look
  and the two fonts, below); the media-query theme and the other exclusions stand.
- **2026-10-13, Export, import with merge, clear.** The export is
  `{ app: "cacador", version: 1, exportedAt, answers, exams, flags }` without question
  state; import refuses anything else unchanged, merges answers by `(questionId, at)`,
  exams by id under the tie rules of § 7 and flags by `(questionId, kind)`, leaves at
  most one exam unfinished, rebuilds every state from the log and reports the counts
  added; Clear progress asks first and keeps the language (§ 7). Reason: a phone and a
  laptop can both hold progress without one wiping the other; the tie rules came from
  the epic review (epic cac-eil D8; brief cac-aqy D8).
- **2026-10-13, Laptop keys.** A, B, C and 1, 2, 3 answer, Enter advances, holding Space
  peeks; the keys live in the practice page, not in the shared card (§ 6.4). Reason: the
  peek stays press-and-hold on a keyboard too, and the exam must leave Space unbound
  (epic cac-eil D9; brief cac-aqy D9).
- **2026-10-13, Out of scope for the app.** Text-to-speech, a browse list of all 506
  questions, links from a nudge's question number, accounts or sync, and a custom
  domain (§ 6.10). Reason: none is in § 6 and none blocks studying (epic cac-eil D10;
  brief cac-aqy D10 and D14). Amended 2026-10-22 by epic cac-zqe: the words drill is in
  scope (below).
- **2026-10-13, Home and Progress.** Home shows readiness against 75 % with the unseen
  count, the exam in progress with its minutes left, and Practice, Exam, Progress and
  Settings; Progress shows readiness, 30 days of bars, the 29 topics, 11 sections and 17
  patterns by group accuracy worst first with "seen x of y", the finished exams and the
  Flagged link; each practice question shows its section, topic and number (§ 6.3,
  § 6.6). Reason: stated as defaults in the brief with no objection; the number lets a
  nudge's cross-reference be found; the counts and the wording came from the epic
  review (epic cac-eil D11; brief cac-aqy D11 and D14). Amended 2026-10-14 by epic
  cac-8cn: Home's buttons are replaced by two cards and the tab bar, and Home gains
  Weakest topics (below).
- **2026-10-13, Installable, offline, updated silently.** vite-plugin-pwa 2.0.0 in
  `generateSW` mode precaches all of `dist`; a new service worker waits and takes over
  on the next cold open, with no prompt and no reload of a screen in use; a flat Ç icon
  in `#f2efe6` on `#14301f`; persistent storage requested once (§ 8.8). Reason: the
  phone opens it full screen and offline, a deploy never leaves a stale shell, and
  taking over mid-question would lose the screen (epic cac-eil D12; brief cac-aqy D12;
  Sumit's 2026-10-08 Installable entry). Amended 2026-10-15 by bead cac-eno: the new
  worker takes over at once and the page reloads at the next change of screen (below).
- **2026-10-13, e2e outside the gates.** A Playwright workspace runs against the
  production build under `vite preview` on port 4173 with the base path and locale
  `en-GB`, by `pnpm e2e` only, never `--pass-with-no-tests` (§ 8.10). Reason: § 8 names
  Playwright and the lint and test gates stay fast (epic cac-eil D13; brief cac-aqy
  D13).
- **2026-10-13, The whole bank in one bundle.** `@cacador/data` is imported as is, about
  109 KB gzipped, and the 15 images reach `dist` and the precache through one image map
  in `apps/web/src/pwa/` (§ 8.7). Reason: no lazy loading is worth that size, and Vite
  emits an asset only when a module imports it (epic cac-eil D14; brief cac-aqy D15).
- **2026-10-13, Record shapes.** Answer, QuestionState, Exam and Flag as § 7 gives them,
  landed as types in `apps/web/src/storage/types.ts` and never widened inside a bead.
  Reason: § 7's shapes with the stored weight dropped (weights are computed, § 6.2) and
  `recent` added, because readiness needs the last three answers without reading the
  log; `chosen` is optional because an unanswered exam question is logged (epic cac-eil
  D15).
- **2026-10-13, Exam ids are random strings.** `Exam.id` and `Answer.examId` are a
  random string made when the exam starts, not an auto-incremented number, and
  `exportedAt` is milliseconds since the epoch like every other time (§ 7). Reason:
  import merges exams by id across two devices, where per-device counters would collide
  (orchestrator's choice during epic cac-eil, reversible; landed in cac-eil.2).
- **2026-10-13, One storage module.** `apps/web/src/storage/` is the only importer of
  `idb`: database `cacador` version 1 with four stores, an answer and its state written
  in one transaction, state always derivable from the log, a conditional exam finish,
  deadline settling on read, the two browser key names exported, and the same API from
  memory when IndexedDB cannot be opened (§ 7). Reason: § 9 IndexedDB for progress; the
  deadline settling and the key ownership came from the epic review (epic cac-eil D16).
- **2026-10-13, The scaffold owns the hot files.** One scaffold bead lands the root
  config, the lockfile, the lint config and Radix check, the web and e2e package files,
  `App.tsx`, `index.css`, the shadcn components, the i18n store and index files and the
  storage types, and installs every dependency the phase needs; no later bead edits them
  (§ 8.4). Reason: phase 2's loader hot file made its beads serial (cac-qre D9, cac-eyh
  D10; epic cac-eil D17). The end-of-epic simplify pass and the review fixes, each
  holding the files it changed alone, later edited some of them; § 8.4 lists which.
- **2026-10-13, Messages split per screen.** One English and one Portuguese message file
  per screen plus `common`, the Portuguese typed by the English so a missing key fails
  lint; a screen bead edits only its own two files; the Flagged copy format is the one
  text in a component (§ 8.3). Reason: screens built in parallel never share a file
  (epic cac-eil D18).
- **2026-10-13, Routes with Home as the hub.** `/`, `/practice`, `/exam/*`, `/progress`,
  `/settings` and `/flagged` under `/cacador/`, a placeholder page per route, the back
  control to Home in the shared layout, no bottom bar (§ 8.2). Reason: fewer shared
  pieces, and the study loop is Practice (epic cac-eil D19). Reversed 2026-10-14 by epic
  cac-8cn for the bottom bar and the back control's place: the menu is a tab bar and
  the back control sits in each screen's header (below).
- **2026-10-13, One question card.** The stem, picture, options, peek, result marking and
  hint panel are one controlled component the page drives (selection, revealed, locked,
  peek and hint enabled); it records nothing and handles no keys (§ 8.6). Reason: one
  card, one behaviour, and the exam needs the unrevealed state (epic cac-eil D20).
- **2026-10-13, Radix banned in the lint gate.** ESLint's `no-restricted-imports` and
  `scripts/check-no-radix.mjs`, copied from Sumit, run inside `pnpm lint` (§ 8).
  Reason: the shadcn registry still serves Radix variants and a wrong `add` would pull
  them in silently (Sumit precedent; epic cac-eil D21).
- **2026-10-13, Models for phase 4.** The Flagged page and focused practice with the
  flags row run on Sonnet; every other phase 4 bead on Opus (§ 8.11). Reason: those two
  copy an existing page; the rest set patterns, own hot files, carry the formulas, the
  schema or the merge, or make screen judgement calls (epic cac-eil D22).
- **2026-10-13, The hint panel opens only when asked.** It opens on the Hint button,
  before or after answering; open at the moment of answering it stays open and gains the
  nudge; it closes on Next, so every question starts closed (§ 6.4). Reason: § 6 says
  hints are shown only when asked for (Ross's default on the epic review; epic cac-eil
  D23).
- **2026-10-13, The window counts the pool's own recent draws.** A draw over a filtered
  pool excludes the last N drawn ids that are in that pool, N its half-pool window,
  read from the app-wide recent list of the ten most recent ids, over excluding the
  last N ids drawn anywhere (§ 6.2). Reason: a small topic would otherwise repeat its
  own last question after a whole-bank draw in between (orchestrator's choice during
  epic cac-eil, reversible; landed in cac-eil.4).
- **2026-10-13, The service worker is registered by hand.**
  `navigator.serviceWorker.register` in `apps/web/src/pwa/registerServiceWorker.ts`,
  after `load` and in production only, over workbox-window or `virtual:pwa-register`;
  workbox-window, which the scaffold installed for D12, is not a dependency of
  `apps/web` (§ 8.8). Reason: the hand
  registration leaves no reload path in the bundle, and the silent update wants none
  (orchestrator's choice during epic cac-eil, reversible; landed in cac-eil.5). Amended
  2026-10-15 by bead cac-eno: the hand registration keeps its own short update path, the
  foreground check and the reload at the next change of screen (below).
- **2026-10-13, An imported exam brings its own answers.** When an import keeps the
  file's copy of an exam over the device's (finished over unfinished, or the earlier
  `finishedAt`), the device's logged answers for that exam id are replaced by the
  file's, over leaving both in the log; it is the one place the answers log is not
  append-only (§ 7). Reason: otherwise one exam would count twice in the question
  states and the day bars (orchestrator's choice during epic cac-eil, reversible;
  landed in cac-eil.12).
- **2026-10-13, A resumed exam opens where it was left.** Reopening an unfinished exam
  opens it on its first unanswered question, over question 1 (§ 6.5). Reason: that is
  where the learner left off (orchestrator's choice during epic cac-eil, reversible;
  landed in cac-eil.9).
- **2026-10-13, An exam ends at its deadline at the latest.** An exam's finish time is
  the earlier of now and its start time plus 30 minutes, so a late auto-submit and the
  settling of a stale exam both land on the deadline, and the storage module refuses
  answer changes once the deadline has passed (§ 7), over taking the moment the submit
  ran. Reason: the exam lasts 30 minutes however late the app gets to submit it, so it
  finishes, and lands on the day bars, at its deadline (orchestrator's choice during
  epic cac-eil, reversible; landed in cac-eil.3).
- **2026-10-13, An import recomputes what the key decides.** An imported answer's
  `correct` and a finished exam's `score` are worked out again from the bank's answer
  key and stored, over refusing a file whose stated values disagree; an exam answer in
  the file must name an exam finished in the same file, as every exam answer in an
  export does (§ 7). Reason: an export made before an answer-key correction should still
  import, and an exam answer with no finished exam beside it is not one the app writes
  (orchestrator's choice during epic cac-eil, reversible; landed in cac-eil.29 and
  cac-eil.30).
- **2026-10-14, The Campo look.** The app is restyled to design direction 1, Campo, a
  field notebook: the paper ground `#F4F0E6`, ink text, forest for the working colour,
  rust for the one thing to do next and for a wrong answer, hairlines and plates, no
  shadows, with the light and dark tokens, the contrast rule, the shapes, the lucide
  icons and the exclusions of § 8.5, and the card's looks of § 8.6. The paper ground
  is the one cream the app allows, by Ross's choice. The reference is `design/campo/`,
  five artboards and a README; the two other directions on the design canvas are never
  precedent. Reason: Ross found the neutral app "not something I would want to use"
  and chose Campo over Alvo and Azulejo on the canvas (epic cac-8cn D1 to D4, D8 to
  D11).
- **2026-10-14, Fraunces and Source Sans 3, self-hosted.** Fraunces 600 for the app
  name, the titles, the stem, the numbers that are the point of a screen and the option
  letters; Source Sans 3 for everything else; both from Fontsource's variable packages,
  upright, latin and latin-ext only, declared by the app's own `@font-face` rules with
  `font-display: swap`, so the build carries exactly four woff2 files, all precached;
  Google Fonts is never linked (§ 8.5, § 8.8). Reverses the system font stack of epic
  cac-eil D7. Reason: the serif is the look, and offline is a product rule, so the
  fonts must come from the app's own cache (epic cac-8cn D3).
- **2026-10-14, A bottom tab bar.** Four tabs, Home, Practice, Exam and Progress, named
  by the navigation words, on every screen except the `/exam` route (the start screen
  and the running exam keep only the back control); Settings from a control on Home's
  header, Flagged from Progress and Settings; the back control to Home at the start of
  every other screen's header, its name unchanged; Home's two cards carry a longer name
  than the tabs (§ 6.3, § 8.2). Reverses epic cac-eil D19's "no bottom bar". Reason:
  Ross asked for "a decent menu system", and four destinations fit a tab bar (epic
  cac-8cn D5 to D7).
- **2026-10-14, Weakest topics on Home.** The two lowest started topics by group
  accuracy, in Progress's worst-first order, each linking to focused practice, with an
  "All topics" link to Progress, and absent while no topic is started; with it the two
  other additions the artboards carry, the count answered on the exam-in-progress card
  and "Submit · N unanswered" (§ 6.3, § 6.5, § 6.6). Reason: the weakest rows make
  Home the place to start; the counts tell the learner where the exam stands (epic
  cac-8cn D7, D9).
- **2026-10-14, Campo ships by merge and push.** The epic branch is merged into `main`
  and `main` is pushed; the push is the deploy, so the site serves the new look at
  once. No pull request and no recording (No epic ceremony, above). Reason: Ross,
  2026-10-14: "merge it straight into main ... available immediately on GitHub pages";
  the authority covers the merge and the push for this epic only (epic cac-8cn D14).
- **2026-10-14, Text on clay is ink.** Text on the clay tint is ink, never rust, in both
  themes: the Not passed chip (clay with ink text and a rust hairline), the word "Wrong"
  on the chosen wrong row and the exam-in-progress card's text; rust appears on clay
  only as the hairline, the rust-filled letter (card text on rust, 5.13:1) and the icon
  (not text, 3:1) (§ 8.5, § 8.6), over the artboards' rust text on clay. Reason: rust
  `#B5461C` on clay `#F3DED2` is 4.20:1, under the 4.5:1 rule, and the tokens are not
  widened to fix it (orchestrator's choice during epic cac-8cn, reversible).
- **2026-10-14, Chips have 6 px corners.** The flag chips on Practice and the language
  chips on Settings take the chip corner of 6 px (§ 8.5 Shape, § 8.6), over the 8 px
  epic cac-8cn D8 gave the flags-row chips. Reason: every chip draws the same shape
  (orchestrator's choice during epic cac-8cn, reversible).
- **2026-10-15, Hold for English and Hint never sit under the text a peek changes.**
  In Practice they are pinned in a dock directly over the tab bar; the layout's footer,
  the dock over the tab bar, is sticky at the foot of the viewport; the hint panel stays
  after the options and is scrolled into view above the dock as it opens; the dock counts
  as the page for the laptop keys. The exam review lists many cards, so one pinned pair
  could not say which card it peeks: each review card opens with its own row instead,
  over the stem (§ 6.4, § 8.2, § 8.6). Replaces the row under the options. Reason:
  Ross, 2026-10-15: the English and the Portuguese take different room, so the button
  jumped from under the thumb mid-hold and the peek ended (bead cac-2tb).
- **2026-10-15, A deploy reaches the open app at the next change of screen.** The
  service worker skips waiting and claims clients, so a new one takes over as soon as
  it has installed; the page asks for an update each time the app comes back to the
  foreground; once a newer worker has taken over a page another one controlled, the
  page reloads at the next change of the router's pathname, never on the screen in use
  and with no prompt (§ 8.8). Amends the 2026-10-13 Installable entry, whose worker
  waited for the next cold open. Reason: Ross, 2026-10-15: the installed app on his
  phone never picked up the cac-2tb deploy, and a learner should not have to close the
  app or clear its cache; Android keeps an installed app alive in the background, so
  every window rarely closes and the waiting worker rarely took over (bead cac-eno).
- **2026-10-15, A round of ten.** Practice gains an end: `/practice?round=<n>` is the
  same weighted draw over the same pool, counted in the screen header's right-hand slot
  and ended after n answers by Finish and a score plate with Another 10; Home's Quick 10
  card, the one filled rust and the width of the column, opens a round of ten over
  the whole bank, and Practice drops to the ink hairline beside Exam (§ 6.3, § 6.4,
  § 8.2). The count is on the screen, never in storage: a change of the query or of
  screen ends the round. Endless practice stays behind the Practice tab and card.
  Reason: Ross, 2026-10-15: with no end goal he started practice and stopped after a
  few questions; knowing three are left is what gets them done (bead cac-zdk).
- **2026-10-22, A words drill.** Rounds of ten at `/words` show a Portuguese term from
  the bank with a short phrase from a question and ask for its English from three
  options; after each answer, the note where the word has one and the whole sentence
  with its question number; a score plate at the end (§ 6.11). Portuguese to English
  only. Reverses the 2026-10-13 Out of scope line that listed a vocabulary drill
  (§ 6.10). Reason: peeking at the English mid-question breaks Ross's flow, and
  teaching the vocabulary itself removes the need; the exam needs recognition, not
  production (brief cac-bc5 D3 to D5).
- **2026-10-22, Which words.** The hunting, wildlife and legal terms plus the general
  exam words, from the 739 of the terms inventory: not the nine months, three weekdays
  and four seasons it lists, nor a term whose only English is the Portuguese word itself
  (ICNF, the Instituto's full name, podengo, ogival, beagle, pointer, terrier); a name
  with an English form stays, and so does a word whose meaning is a question's answer
  (seixa 278, láparos 83, terçó 503). About 720 words (§ 3.3, § 5 step 5 rule 3).
  Reason: the general words are what stop Ross reading a stem, months and days he can
  learn anywhere, and an option identical to the prompt teaches nothing; knowing an
  answer-word is what its question tests (epic cac-zqe D1; brief cac-bc5 D1 and D14).
- **2026-10-22, The words list, one file per kind.** `packages/data/words/`, twelve
  files `<kind>.json` (species, anatomy, life, habitat, ground, method, weapon, dog,
  falconry, law, time, general, mapped from the inventory's categories), each entry
  exactly `{ pt, phrase, en, kind, ids, note }`, one entry per line, the file sorted by
  `pt`, with no cap on a file's length; the glossaries, translations, hints and
  questions are not edited. The inventory and the 17-entry sample are committed
  unchanged as `source/terms-inventory.json` and `source/words-sample.json`, a writer's
  sources never imported by the app or the validator (§ 3, § 3.3). Reason: the
  glossaries are a translator's tool; the largest kind is a tenth of a question chunk's
  text, and kind equal to file makes the same-kind wrong options a lookup of one file;
  the headless run reads nothing outside the repo (epic cac-zqe D2, and D7 the planner's
  choice, reversible; brief cac-bc5 D6 and D17).
- **2026-10-22, A word's questions and phrase.** `ids` lists every question that uses
  the word in the entry's sense, inflected forms included; `phrase` is verbatim from at
  least one of them, ignoring case and curly quotes, and the drill shows the first named
  question that holds it (§ 3.3, § 4 rule 9). Chosen over the brief's "phrase in every
  named question". Reason: in the sample Ross approved, 14 of the 17 entries name
  questions that do not hold the phrase (toca names 8 and its phrase is in 64 only), so
  that rule would fail the precedent and throw away the occurrence list cac-5y0 needs
  (epic cac-zqe D3, the planner's choice, reversible; reconciles brief cac-bc5 D6 with
  D11).
- **2026-10-22, A word's English is the translation's.** `en` is the English the
  translation uses; where a glossary has the word, it is the glossary's `en`, or the
  gloss when that `en` is the Portuguese with a gloss in parentheses; a species is
  capitalised as the glossary writes it, other words lower case; `en` never contains
  the `pt` as a whole word. Where the sample breaks this, the rule wins: `cio` is
  "rut" and its note keeps heat (§ 3.3, § 5 step 5 rule 7). Reason: the drill and the
  peek must give the same English (epic cac-zqe D4; brief cac-bc5 D6 and D11).
- **2026-10-22, Notes after answering.** A word's note is English, one sentence or two
  short ones, shown only after answering, for a false friend, a second meaning, or a
  method, role, ground or legal word whose English alone does not separate it from its
  neighbours; empty otherwise, never a grammar lesson (§ 3.3, § 5 step 5 rule 8).
  Reason: those are the words that trip Ross, and batida and montaria both read as a
  drive in English (epic cac-zqe D5; brief cac-bc5 D8, D11 and D13).
- **2026-10-22, Words writers and checkers.** Opus writers, one bead per group of kinds,
  from the inventory and the bank side by side; a checker bead per writer bead by a
  different agent, fixing in place; the sample is the precedent every one reads first
  and goes through the checker like the rest; each edits only its own kind files, and
  what belongs elsewhere, and every translation or glossary slip, goes in its close
  reason for the tail bead, which appends the slips to cac-4x1 (§ 5 step 5). Reason:
  the content phases' writer and checker pattern worked (epic cac-zqe D6; brief cac-bc5
  D7 and D11).
- **2026-10-22, Validator rule 9.** `words/` holds exactly the twelve kind files; every
  entry has the six fields with their types, its file's kind and ascending distinct
  bank ids; `pt` is unique across the twelve files; the phrase is in a named question;
  `en` follows the glossary and never holds the `pt`; the validator prints the words
  count, and an empty file passes (§ 4 rule 9). Reason: the check keeps the drill's
  English and the peek's identical, and an empty file keeps the scaffold and a
  half-run phase green (epic cac-zqe D8; brief cac-bc5 D6).
- **2026-10-22, The words screen.** Route `/words`, its own folder and its own two
  message files; the tab bar with no tab current; the screen header's eyebrow form with
  the eyebrow "Words" and the round's counter in the slot; the word in Fraunces over its
  phrase and three option rows in the question card's look; no peek, Hint or flags row;
  after answering the rows marked and locked and a moss-tint panel with the note and
  "Question N" over the Portuguese sentence, the phrase in Fraunces 600; Next, or
  Finish on the tenth (§ 6.11, § 8.2). Reason: the drill reuses the pieces Practice's
  round already draws (epic cac-zqe D9, the planner's choice, reversible).
- **2026-10-22, A words round and its score.** Always ten words; Finish shows "Round
  done" with the count right and the round's ten words with their English, the missed
  ones marked, and Another 10. Nothing about words is recorded: no answer log, no
  question state, nothing on Progress, readiness or Weakest topics (§ 6.11). Reason:
  Ross wants equal coverage of every word, not word progress, and a missed word does
  not return for 70-odd rounds, so the plate is the second look (epic cac-zqe D10;
  brief cac-bc5 D3 and D16).
- **2026-10-22, Same-kind wrong options.** The right English and two others drawn at
  random from the same kind, each differing from the others ignoring case, topped up
  from the whole list when a kind cannot supply two; the right answer's place random;
  the draw takes the model's seeded random source (§ 6.11). Reason: matches the exam
  and the phone, and same-kind options test meaning, not category (epic cac-zqe D11;
  brief cac-bc5 D2).
- **2026-10-22, One shuffled pass.** One pass over every word, all kinds mixed; a word
  is spent when answered, so a round left half-way, a reload or Another 10 carries on
  at the first unanswered word; a round never shows a word twice; a spent pass
  reshuffles; words an update adds join the unseen part, words it removes are skipped,
  and a garbled stored pass starts afresh; the place is never shown (§ 6.11). Reason:
  equal coverage with nothing to track, and a filter by kind would break it (epic
  cac-zqe D12; brief cac-bc5 D9, D12 and D15).
- **2026-10-22, The pass in localStorage.** A third browser key, localStorage
  `cacador.words`, owned by the storage module and kept as `storage/recent.ts` keeps
  the no-repeat window, in memory for the page when Web Storage is blocked; Clear
  progress removes it and its memory copy and keeps `cacador.locale`; it is not in the
  export, which stays version 1 with import untouched (§ 6.9, § 7). Over IndexedDB,
  where a new store would bump the database version and change `storage/types.ts` for
  one small list. Reason: the pass is a place, not progress (epic cac-zqe D13, the
  planner's choice, reversible).
- **2026-10-22, The drill's language.** The drill's own words and Home's card follow the
  interface language through English and pt-PT message files; the word, its phrase
  and the sentence stay Portuguese, and the options and the note English, in either
  interface language (§ 6.1, § 6.11). Reason: the drill is Portuguese to English only
  (epic cac-zqe D14; brief cac-bc5 D5).
- **2026-10-22, Words laptop keys.** A, B, C and 1, 2, 3 answer, Enter advances or
  finishes on the tenth, Space is unbound; the keys act from the page and the dock,
  never from the back control or the tab bar, and Enter on a focused button activates
  it (§ 6.11). Reason: they follow Practice's (Laptop keys, above), less the peek
  (epic cac-zqe D15, the planner's choice, reversible).
- **2026-10-22, A Words card on Home.** Directly under Quick 10, the width of the column
  with the ink hairline and the book-open icon, title "Words" and line "10 terms from
  the bank · Portuguese to English", its accessible name the title and the line;
  Practice and Exam stay side by side under it, and Quick 10 stays the one rust card
  (§ 6.3). Reason: the brief asked for a card beside Quick 10, and one rust card keeps
  the one thing to do next (epic cac-zqe D16; brief cac-bc5 D3).
- **2026-10-22, Phase 5 file ownership.** The scaffolding bead alone edits the data
  loader, scripts and tests; the storage and model bead alone edits
  `apps/web/src/storage/**` and `apps/web/src/model/**`; the screen bead alone edits
  `App.tsx` and the message indexes; the e2e bead owns `e2e/**` and `CLAUDE.md`; no new
  dependency (§ 8.4). Reason: hot files have one owner, so beads beside each other never
  share a file (epic cac-zqe D17, the planner's choice, reversible).
