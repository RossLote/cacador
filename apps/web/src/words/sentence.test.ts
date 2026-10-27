import { describe, expect, it } from 'vitest';
import { sentenceFor } from './sentence';
import { testWord } from './testWords';
import { question } from '../../test/fixtures';

/** The part of the sentence the phrase takes. */
const phraseIn = (pt: string) => {
  const sentence = sentenceFor(testWord(pt))!;
  return sentence.text.slice(sentence.start, sentence.end);
};

describe('sentenceFor', () => {
  it("is the stem when the stem holds the phrase, the phrase cut out as the bank prints it", () => {
    const sentence = sentenceFor(testWord('cio'))!;
    expect(sentence.id).toBe(109);
    expect(sentence.text).toBe(question(109).question);
    expect(phraseIn('cio')).toBe('O cio da raposa');
  });

  it('is the stem followed by the option that holds the phrase, in the case the option prints it', () => {
    const sentence = sentenceFor(testWord('levantar'))!;
    const q = question(19);
    expect(sentence.id).toBe(19);
    expect(sentence.text).toBe(`${q.question} ${q.options.B}`);
    // The phrase is written in lower case; the option opens with a capital, which the sentence keeps.
    expect(phraseIn('levantar')).toBe('Procurar, perseguir e levantar espécies de caça maior');
  });

  it('comes from the first of the ids whose question holds the phrase, passing over one that does not', () => {
    const sentence = sentenceFor(testWord('toca'))!;
    expect(sentence.id).toBe(64);
    expect(sentence.text).toBe(`${question(64).question} ${question(64).options.C}`);
    expect(phraseIn('toca')).toBe('Tocas de habitação individuais');
  });

  it('never starts or ends the highlight inside a word, passing over a question that holds the phrase only inside a longer word', () => {
    // Question 83's option C is "Listados": the phrase is cut inside it there, so the sentence is question 131's.
    expect(question(83).options.C).toBe('Listados');
    const listado = { ...testWord('láparo'), pt: 'listado', phrase: 'Listado', ids: [83, 131] };
    const sentence = sentenceFor(listado)!;
    expect(sentence.id).toBe(131);
    expect(sentence.text).toBe(`${question(131).question} ${question(131).options.A}`);
    expect(sentence.text.slice(sentence.start, sentence.end)).toBe('Listado');
    expect(sentence.end).toBe(sentence.text.length);
    // A phrase cut out of the middle of a word holds no sentence at all.
    expect(sentenceFor({ ...testWord('cio'), phrase: 'O cio da rapos' })).toBeUndefined();
  });

  it('is undefined for a word none of whose questions holds its phrase', () => {
    expect(sentenceFor({ ...testWord('cio'), ids: [1, 2] })).toBeUndefined();
  });
});
