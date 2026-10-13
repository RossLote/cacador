import { describe, expect, it } from 'vitest';
import { readExportFile, validateExportFile } from './exportFile';
import { planImport, replacesExam, replacesFlag } from './merge';
import type { Exam, ExportFile } from './types';

const exam = (fields: Partial<Exam> = {}): Exam => ({ id: 'e', startedAt: 0, questionIds: [1, 2, 3], answers: {}, ...fields });
const file = (fields: Partial<ExportFile> = {}): ExportFile => ({ app: 'cacador', version: 1, exportedAt: 0, answers: [], exams: [], flags: [], ...fields });

describe('replacesExam', () => {
  it('follows D8: finished beats unfinished, the earlier finish, more answers, the kept copy on a tie', () => {
    const done = (finishedAt: number) => exam({ finishedAt, score: 0 });
    expect(replacesExam(done(5), exam())).toBe(true);
    expect(replacesExam(exam(), done(5))).toBe(false);
    expect(replacesExam(done(4), done(5))).toBe(true);
    expect(replacesExam(done(5), done(4))).toBe(false);
    expect(replacesExam(done(5), done(5))).toBe(false);
    expect(replacesExam(exam({ answers: { 1: 'A', 2: 'B' } }), exam({ answers: { 1: 'A' } }))).toBe(true);
    expect(replacesExam(exam({ answers: { 1: 'A' } }), exam({ answers: { 2: 'B' } }))).toBe(false);
  });
});

describe('replacesFlag', () => {
  it('keeps the newer, the kept one on a tie', () => {
    const flag = (at: number) => ({ questionId: 1, kind: 'hint' as const, note: '', at });
    expect(replacesFlag(flag(2), flag(1))).toBe(true);
    expect(replacesFlag(flag(1), flag(1))).toBe(false);
  });
});

describe('planImport', () => {
  it('leaves the device alone and adds nothing for an empty file', () => {
    const device = { answers: [{ id: 1, questionId: 1, at: 5, chosen: 'A' as const, correct: true, mode: 'practice' as const }], exams: [], flags: [] };
    const plan = planImport(device, file());
    expect(plan).toMatchObject({ removeAnswerIds: [], addAnswers: [], putExams: [], putFlags: [], added: { answers: 0, exams: 0, flags: 0 } });
    expect(plan.states).toEqual([{ questionId: 1, attempts: 1, correct: 1, streak: 1, recent: [true], lastSeenAt: 5 }]);
  });

  it('keeps one copy of a duplicated record within the file', () => {
    const answer = { questionId: 2, at: 9, correct: false, mode: 'exam' as const, examId: 'x' };
    const plan = planImport({ answers: [], exams: [], flags: [] }, file({ answers: [answer, answer], exams: [exam(), exam()] }));
    expect(plan.added).toEqual({ answers: 1, exams: 1, flags: 0 });
  });
});

describe('validateExportFile', () => {
  const answer = { questionId: 4, at: 10, chosen: 'B', correct: false, mode: 'practice' };

  it('rebuilds records from their known fields, dropping log ids and anything else', () => {
    const result = validateExportFile({
      ...file(),
      extra: true,
      answers: [{ ...answer, id: 12, note: 'x' }],
      exams: [{ ...exam({ answers: { 2: 'C' } }), finishedAt: 7, score: 0, colour: 'red' }],
      flags: [{ questionId: 4, kind: 'translation', note: 'n', at: 3, by: 'me' }],
    });
    expect(result).toEqual({
      ok: true,
      file: {
        ...file(),
        answers: [answer],
        exams: [{ ...exam({ answers: { 2: 'C' } }), finishedAt: 7, score: 0 }],
        flags: [{ questionId: 4, kind: 'translation', note: 'n', at: 3 }],
      },
    });
  });

  it('accepts an unanswered exam question: no chosen option, wrong', () => {
    const unanswered = { questionId: 4, at: 10, correct: false, mode: 'exam', examId: 'e' };
    expect(validateExportFile({ ...file(), answers: [unanswered] })).toMatchObject({ ok: true });
  });

  it.each([
    ['an answer with no chosen option in practice', { answers: [{ ...answer, chosen: undefined }] }],
    ['an answer with no chosen option counted right', { answers: [{ ...answer, chosen: undefined, mode: 'exam', correct: true }] }],
    ['an answer for question 0', { answers: [{ ...answer, questionId: 0 }] }],
    ['an answer with a text time', { answers: [{ ...answer, at: '10' }] }],
    ['an answer in an unknown mode', { answers: [{ ...answer, mode: 'drill' }] }],
    ['an exam finished with no score', { exams: [{ ...exam(), finishedAt: 7 }] }],
    ['an exam with no id', { exams: [{ ...exam(), id: '' }] }],
    ['an exam answer keyed by a non-question', { exams: [exam({ answers: { 1: 'A' } }), { ...exam(), answers: { x: 'A' } }] }],
    ['an exam answer that is not an option', { exams: [{ ...exam(), answers: { 1: 'D' } }] }],
    ['a flag of an unknown kind', { flags: [{ questionId: 1, kind: 'image', note: '', at: 0 }] }],
    ['a flag with no note', { flags: [{ questionId: 1, kind: 'hint', at: 0 }] }],
    ['a list that is not a list', { exams: {} }],
    ['no export time', { exportedAt: undefined }],
  ])('refuses the whole file for %s', (_, fields) => {
    expect(validateExportFile({ ...file(), ...fields })).toEqual({ ok: false, reason: 'malformed' });
  });

  it('names why a file is not a version 1 Caçador export', () => {
    expect(validateExportFile(null)).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validateExportFile('cacador')).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validateExportFile({ ...file(), app: undefined })).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validateExportFile({ ...file(), version: '1' })).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(readExportFile('')).toEqual({ ok: false, reason: 'not-json' });
    expect(readExportFile(JSON.stringify(file()))).toEqual({ ok: true, file: file() });
  });
});
