import { describe, expect, it } from 'vitest';
import { EXAM_DURATION_MS, MINUTE_MS } from '@/model';
import { CLOCK_SKEW_MS, readExportFile, validateExportFile } from './exportFile';
import { planImport, replacesExam, replacesFlag } from './merge';
import type { Exam, ExportFile } from './types';
import { correctOf, wrongOf } from '../../test/fixtures';

/** Questions 1 to 20, an exam's worth of bank ids. */
const TWENTY = Array.from({ length: 20 }, (_, i) => i + 1);
const exam = (fields: Partial<Exam> = {}): Exam => ({ id: 'e', startedAt: 0, questionIds: TWENTY, answers: {}, ...fields });
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
    const plan = planImport(device, file(), 10);
    expect(plan).toMatchObject({ removeAnswerIds: [], addAnswers: [], putExams: [], putFlags: [], added: { answers: 0, exams: 0, flags: 0 } });
    expect(plan.states).toEqual([{ questionId: 1, attempts: 1, correct: 1, streak: 1, recent: [true], lastSeenAt: 5 }]);
  });

  it('keeps one copy of a duplicated record within the file', () => {
    const answer = { questionId: 2, at: 9, correct: false, mode: 'exam' as const, examId: 'x' };
    const plan = planImport({ answers: [], exams: [], flags: [] }, file({ answers: [answer, answer], exams: [exam(), exam()] }), 10);
    expect(plan.added).toEqual({ answers: 1, exams: 1, flags: 0 });
  });

  describe('a second unfinished exam', () => {
    // The device's exam started at 10:00; the file's at 10:05.
    const own = exam({ id: 'own', startedAt: 0 });
    const theirs = exam({ id: 'theirs', startedAt: 5 * MINUTE_MS });
    const settledAt = (now: number) => {
      const plan = planImport({ answers: [], exams: [own], flags: [] }, file({ exams: [theirs] }), now);
      const settled = plan.putExams.find((e) => e.id === own.id);
      return { finishedAt: settled?.finishedAt, logged: [...new Set(plan.addAnswers.map((a) => a.at))] };
    };

    it('submits the older at the moment of the import while its deadline is still ahead, never in the future', () => {
      expect(settledAt(12 * MINUTE_MS)).toEqual({ finishedAt: 12 * MINUTE_MS, logged: [12 * MINUTE_MS] });
    });

    it('submits the older at its deadline once that has passed', () => {
      expect(settledAt(40 * MINUTE_MS)).toEqual({ finishedAt: EXAM_DURATION_MS, logged: [EXAM_DURATION_MS] });
    });
  });
});

describe('validateExportFile', () => {
  const NOW = 60 * MINUTE_MS;
  const validate = (fields: Record<string, unknown>) => validateExportFile({ ...file(), ...fields }, NOW);
  const answer = { questionId: 4, at: 10, chosen: wrongOf(4), correct: false, mode: 'practice' };
  const finished = { ...exam(), finishedAt: 7, score: 0 };
  /** An exam answer to question 4 of the finished exam `e`. */
  const examAnswer = { questionId: 4, at: 7, chosen: wrongOf(4), correct: false, mode: 'exam', examId: 'e' };

  it('rebuilds records from their known fields, dropping log ids and anything else', () => {
    const result = validate({
      extra: true,
      answers: [{ ...answer, id: 12, note: 'x' }],
      exams: [{ ...exam({ answers: { 2: wrongOf(2) } }), finishedAt: 7, score: 0, colour: 'red' }],
      flags: [{ questionId: 4, kind: 'translation', note: 'n', at: 3, by: 'me' }],
    });
    expect(result).toEqual({
      ok: true,
      file: {
        ...file(),
        answers: [answer],
        exams: [{ ...exam({ answers: { 2: wrongOf(2) } }), finishedAt: 7, score: 0 }],
        flags: [{ questionId: 4, kind: 'translation', note: 'n', at: 3 }],
      },
    });
  });

  it('accepts an unanswered exam question: no chosen option, wrong, in a finished exam of the file', () => {
    const unanswered = { questionId: 4, at: 10, correct: false, mode: 'exam', examId: 'e' };
    expect(validate({ answers: [unanswered], exams: [finished] })).toMatchObject({ ok: true });
  });

  it('works out correct and score from the bank key instead of taking them from the file', () => {
    const result = validate({
      answers: [
        { ...answer, chosen: wrongOf(4), correct: true },
        { ...answer, at: 11, chosen: correctOf(4), correct: false },
      ],
      exams: [
        { ...exam({ id: 'claims-all', answers: { 1: wrongOf(1) } }), finishedAt: 7, score: 20 },
        { ...exam({ id: 'claims-none', answers: { 1: correctOf(1), 2: correctOf(2) } }), finishedAt: 7, score: 0 },
      ],
    });
    expect(result.ok && result.file.answers.map((a) => a.correct)).toEqual([false, true]);
    expect(result.ok && result.file.exams.map((e) => e.score)).toEqual([0, 2]);
  });

  it('accepts times up to five minutes ahead of the clock, two devices never agreeing exactly', () => {
    const late = NOW + CLOCK_SKEW_MS;
    expect(CLOCK_SKEW_MS).toBe(5 * MINUTE_MS);
    expect(
      validate({
        exportedAt: late,
        answers: [{ ...answer, at: late }],
        exams: [exam({ startedAt: late })],
        flags: [{ questionId: 1, kind: 'hint', note: '', at: late }],
      }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    // Answers (D15, isWellFormedAnswer).
    ['an answer with no chosen option in practice', { answers: [{ ...answer, chosen: undefined }] }],
    ['a practice answer naming an exam', { answers: [{ ...answer, examId: 'e' }], exams: [finished] }],
    ['an answer with no chosen option counted right', { answers: [{ ...examAnswer, chosen: undefined, correct: true }], exams: [finished] }],
    ['an exam answer naming no exam', { answers: [{ ...examAnswer, examId: undefined }], exams: [finished] }],
    ['an exam answer to an exam not in the file', { answers: [{ ...examAnswer, examId: 'other' }], exams: [finished] }],
    ['an exam answer to an unfinished exam', { answers: [examAnswer], exams: [exam()] }],
    ['an answer for question 0', { answers: [{ ...answer, questionId: 0 }] }],
    ['an answer for a question not in the bank', { answers: [{ ...answer, questionId: 507 }] }],
    ['an answer with a text time', { answers: [{ ...answer, at: '10' }] }],
    ['an answer in an unknown mode', { answers: [{ ...answer, mode: 'drill' }] }],
    // Exams.
    ['an exam finished with no score', { exams: [{ ...exam(), finishedAt: 7 }] }],
    ['an exam with no id', { exams: [{ ...exam(), id: '' }] }],
    ['an exam of 19 questions', { exams: [exam({ questionIds: TWENTY.slice(1) })] }],
    ['an exam of 21 questions', { exams: [exam({ questionIds: [...TWENTY, 21] })] }],
    ['an exam asking one question twice', { exams: [exam({ questionIds: [...TWENTY.slice(1), 2] })] }],
    ['an exam with a question not in the bank', { exams: [exam({ questionIds: [...TWENTY.slice(1), 507] })] }],
    ['an exam answer keyed by a non-question', { exams: [exam({ answers: { 1: 'A' } }), { ...exam(), answers: { x: 'A' } }] }],
    ['an exam answer to a question not in the exam', { exams: [exam({ answers: { 21: 'A' } })] }],
    ['an exam answer that is not an option', { exams: [{ ...exam(), answers: { 1: 'D' } }] }],
    ['an exam finished before it started', { exams: [{ ...exam({ startedAt: 10 }), finishedAt: 9, score: 0 }] }],
    ['an exam finished after its 30 minutes', { exams: [{ ...exam(), finishedAt: EXAM_DURATION_MS + 1, score: 0 }] }],
    // Flags.
    ['a flag of an unknown kind', { flags: [{ questionId: 1, kind: 'image', note: '', at: 0 }] }],
    ['a flag with no note', { flags: [{ questionId: 1, kind: 'hint', at: 0 }] }],
    ['a flag on a question not in the bank', { flags: [{ questionId: 507, kind: 'hint', note: '', at: 0 }] }],
    // Times later than the import's moment.
    ['an export made in the future', { exportedAt: NOW + CLOCK_SKEW_MS + 1 }],
    ['an answer given in the future', { answers: [{ ...answer, at: NOW + CLOCK_SKEW_MS + 1 }] }],
    ['an exam started in the future', { exams: [exam({ startedAt: NOW + CLOCK_SKEW_MS + 1 })] }],
    ['an exam finished in the future', { exams: [{ ...exam({ startedAt: NOW }), finishedAt: NOW + CLOCK_SKEW_MS + 1, score: 0 }] }],
    ['a flag set in the future', { flags: [{ questionId: 1, kind: 'hint', note: '', at: NOW + CLOCK_SKEW_MS + 1 }] }],
    // The file.
    ['a list that is not a list', { exams: {} }],
    ['no export time', { exportedAt: undefined }],
  ])('refuses the whole file for %s', (_, fields) => {
    expect(validate(fields)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('names why a file is not a version 1 Caçador export', () => {
    expect(validateExportFile(null, NOW)).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validateExportFile('cacador', NOW)).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validate({ app: undefined })).toEqual({ ok: false, reason: 'not-cacador' });
    expect(validate({ version: '1' })).toEqual({ ok: false, reason: 'unsupported-version' });
    expect(readExportFile('', NOW)).toEqual({ ok: false, reason: 'not-json' });
    expect(readExportFile(JSON.stringify(file()), NOW)).toEqual({ ok: true, file: file() });
  });
});
