import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ExtractError, parseQuestions } from '../scripts/lib/parse.mjs';
import { questionById, questions } from '../src/index';

interface ReferenceQuestion {
  id: number;
  section: string;
  question: string;
  options: { letter: string; text: string }[];
  correct_answer: string;
}

const reference = JSON.parse(readFileSync(fileURLToPath(new URL('../source/reference-2026-05.json', import.meta.url)), 'utf8')) as ReferenceQuestion[];
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

// The reference glues a heading onto the last option (DESIGN.md § 2.2 item 4) or keeps a space after a hyphen (item 3).
const HEADING_GLUED = [10, 58, 320, 361, 412, 415, 462, 474, 479, 498];
const HYPHEN_ARTEFACT = [411, 455];
const KNOWN_GLITCHES = new Set([...HEADING_GLUED, ...HYPHEN_ARTEFACT]);

describe('extracted questions against the reference parse', () => {
  it('compares all 506 ids', () => {
    expect(reference).toHaveLength(506);
    expect(questions).toHaveLength(506);
  });

  it('has the same answer letter on every id', () => {
    const differing = reference.filter((r) => questionById(r.id)?.answer !== r.correct_answer).map((r) => r.id);
    expect(differing).toEqual([]);
  });

  it('has the same stem and options on every id but the known glitches', () => {
    const differing: number[] = [];
    for (const r of reference) {
      if (KNOWN_GLITCHES.has(r.id)) continue;
      const q = questionById(r.id);
      const same =
        q !== undefined &&
        collapse(q.question) === collapse(r.question) &&
        r.options.every((o) => collapse(q.options[o.letter as 'A' | 'B' | 'C']) === collapse(o.text));
      if (!same) differing.push(r.id);
    }
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

const lines = (text: string) => text.split('\n').map((line) => ({ page: 1, text: line }));

// One of each hazard of DESIGN.md § 2.2, in a document of four questions.
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
BETA
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

const failure = (text: string, total: number): unknown => {
  try {
    parseQuestions(lines(text), manifest, total);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('parseQuestions on the hazards of DESIGN.md § 2.2', () => {
  const parsed = parseQuestions(lines(HAZARDS), manifest, 4);

  it('handles the number separators "1 - ", "2 – " and "3- "', () => {
    expect(parsed.map((q) => q.id)).toEqual([1, 2, 3, 4]);
  });

  it('ignores the intro paragraph before the first heading', () => {
    expect(parsed).toHaveLength(4);
    expect(parsed[0]?.stem).toBe('Qual a perdiz que tem bico vermelho?');
  });

  it('joins a wrapped stem and wrapped options, rejoining a hyphen without a space', () => {
    expect(parsed[0]?.options).toEqual(['Perdiz-vermelha', 'Perdiz-comum', 'Outra']);
    expect(parsed[1]?.stem).toBe('Segundo o que diz o regulamento?');
  });

  it('reads "*" glued to the word, after a space, and on a line of its own', () => {
    expect(parsed.map((q) => q.answer)).toEqual(['A', 'A', 'B', 'C']);
    expect(parsed[1]?.options[0]).toBe('Pedir ao ICNF um papel');
    expect(parsed[3]?.options[2]).toBe('Terceira coisa');
  });

  it('keeps ICNF alone on a line inside an option and does not take it for a heading', () => {
    expect(parsed[1]?.options[0]).toContain('ICNF');
  });

  it('closes the last option at a heading with no blank line, and assigns the section', () => {
    expect(parsed[1]?.options[2]).toBe('Outra coisa');
    expect(parsed.map((q) => q.section.slug)).toEqual(['alfa', 'alfa', 'beta', 'beta']);
  });

  it('fails loudly on the wrong count', () => {
    const error = failure(HAZARDS, 5);
    expect(error).toBeInstanceOf(ExtractError);
    expect((error as Error).message).toMatch(/parsed 4 questions, expected 5/);
  });

  it('fails loudly on two starred options', () => {
    const error = failure(HAZARDS.replace('B) Perdiz-comum', 'B) Perdiz-comum*'), 4);
    expect(error).toBeInstanceOf(ExtractError);
    expect((error as Error).message).toMatch(/question 1 \(page 1\): expected exactly one option marked \*, found 2/);
  });

  it('fails loudly on zero starred options', () => {
    const error = failure(HAZARDS.replace('vermelha*', 'vermelha'), 4);
    expect(error).toBeInstanceOf(ExtractError);
    expect((error as Error).message).toMatch(/question 1 \(page 1\): expected exactly one option marked \*, found 0/);
  });
});
