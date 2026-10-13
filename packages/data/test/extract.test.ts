import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clean, ExtractError, parseQuestions, toLines } from '../scripts/lib/parse.mjs';
import { manifest as bank, questionById, questions } from '../src/index';

interface ReferenceQuestion {
  id: number;
  section: string;
  question: string;
  options: { letter: string; text: string }[];
  correct_answer: string;
}

const reference = JSON.parse(readFileSync(new URL('../source/reference-2026-05.json', import.meta.url), 'utf8')) as ReferenceQuestion[];

// The reference keeps a space after a wrap hyphen (DESIGN.md § 2.2 item 3) and glues the next
// section heading onto the last option (item 4); undo both so every id compares.
const headings = bank.sections.map((s) => s.heading);
const comparable = (text: string) => {
  const heading = headings.find((h) => text.endsWith(` ${h}`));
  return clean(heading ? text.slice(0, -heading.length) : text).replace(/- /g, '-');
};

describe('extracted questions against the reference parse', () => {
  it('compares all 506 ids', () => {
    expect(reference).toHaveLength(506);
    expect(questions).toHaveLength(506);
  });

  it('has the same answer letter on every id', () => {
    const differing = reference.filter((r) => questionById(r.id)?.answer !== r.correct_answer).map((r) => r.id);
    expect(differing).toEqual([]);
  });

  it('has the same stem and options on every id', () => {
    const differing = reference
      .filter((r) => {
        const q = questionById(r.id);
        return (
          q === undefined ||
          comparable(q.question) !== comparable(r.question) ||
          r.options.some((o) => comparable(q.options[o.letter as 'A' | 'B' | 'C']) !== comparable(o.text))
        );
      })
      .map((r) => r.id);
    expect(differing).toEqual([]);
  });

  it('rejoins hyphenated words without a space (411, 455)', () => {
    expect(questionById(411)?.options.B).toContain('pôr-do-sol');
    expect(questionById(455)?.question).toContain('perdiz-vermelha');
  });

  it('keeps curly quotes and the apostrophe of the PDF', () => {
    expect(questionById(134)?.question).toContain('“raiada”');
    expect(questionById(235)?.question).toContain('“espelho alar”');
    expect(questionById(24)?.options.A).toContain('galinha-d’água');
  });
});

const manifest = {
  sections: [
    { slug: 'alfa', heading: 'ALFA', from: 1, to: 2 },
    { slug: 'beta', heading: 'BETA', from: 3, to: 4 },
  ],
};

// One of each hazard of DESIGN.md § 2.2, in a document of four questions on two pages.
const HAZARDS = `Introdução ao questionário
1 - isto não é uma pergunta
ALFA
1 - Qual a perdiz que tem
bico vermelho?
A) Perdiz-
vermelha*
B) Perdiz-comum
C) Outra
2 – Segundo o que
diz o regulamento?
A) Pedir ao
ICNF
um papel *
B) Nada
C) Outra coisa
\fBETA
3- Qual é o zarro?
A) Zarro
B) Zarro-comum*
C) Zarro-bastardo
4 - Última pergunta?
A) Primeira
B) Segunda
C) Terceira
coisa
*`;

const parse = (text: string, total: number) => () => parseQuestions(toLines(text), manifest, total);

describe('parseQuestions on the hazards of DESIGN.md § 2.2', () => {
  const parsed = parse(HAZARDS, 4)();

  it('handles the number separators "1 - ", "2 – " and "3- "', () => {
    expect(parsed.map((q) => q.id)).toEqual([1, 2, 3, 4]);
  });

  it('ignores the intro paragraph before the first heading', () => {
    expect(parsed[0]?.stem).toBe('Qual a perdiz que tem bico vermelho?');
  });

  it('joins a wrapped stem and wrapped options, rejoining a hyphen without a space', () => {
    expect(parsed[0]?.options).toEqual(['Perdiz-vermelha', 'Perdiz-comum', 'Outra']);
    expect(parsed[1]?.stem).toBe('Segundo o que diz o regulamento?');
  });

  it('reads "*" glued to the word, after a space, and on a line of its own', () => {
    expect(parsed.map((q) => q.answer)).toEqual(['A', 'A', 'B', 'C']);
    expect(parsed[3]?.options[2]).toBe('Terceira coisa');
  });

  it('keeps ICNF alone on a line inside an option and does not take it for a heading', () => {
    expect(parsed[1]?.options[0]).toBe('Pedir ao ICNF um papel');
  });

  it('closes the last option at a heading with no blank line, and assigns the section and page', () => {
    expect(parsed[1]?.options[2]).toBe('Outra coisa');
    expect(parsed.map((q) => q.section.slug)).toEqual(['alfa', 'alfa', 'beta', 'beta']);
    expect(parsed.map((q) => q.page)).toEqual([1, 1, 2, 2]);
  });

  it('fails loudly on the wrong count', () => {
    expect(parse(HAZARDS, 5)).toThrow(ExtractError);
    expect(parse(HAZARDS, 5)).toThrow(/parsed 4 questions, expected 5 \(last parsed: question 4 on page 2/);
  });

  it('fails loudly on two starred options', () => {
    expect(parse(HAZARDS.replace('B) Perdiz-comum', 'B) Perdiz-comum*'), 4)).toThrow(/question 1 \(page 1\): expected exactly one option marked \*, found 2/);
  });

  it('fails loudly on zero starred options', () => {
    expect(parse(HAZARDS.replace('B) Zarro-comum*', 'B) Zarro-comum'), 4)).toThrow(/question 3 \(page 2\): expected exactly one option marked \*, found 0/);
  });
});
