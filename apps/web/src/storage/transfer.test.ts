import type { OptionKey } from '@cacador/data';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawExam, EXAM_DURATION_MS, seededRandom } from '@/model';
import { finishExamRecords } from './finish';
import { withoutLogId } from './state';
import {
  clearProgress,
  createExam,
  closeStorage,
  exportFileName,
  exportProgress,
  finishExam,
  getExam,
  getStates,
  importProgress,
  listAnswers,
  listExams,
  listFlags,
  LOCALE_KEY,
  recordAnswer,
  RECENT_KEY,
  setFlag,
  storageMode,
  type Answer,
  type Exam,
  type ExportFile,
} from './index';
import { correctOf, wrongOf } from '../../test/fixtures';
import { answerExam, failStore } from '../../test/storage';

const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 9, 13, 9, 0);

const allOf = (ids: readonly number[], pick: (id: number) => OptionKey): Record<number, OptionKey> =>
  Object.fromEntries(ids.map((id) => [id, pick(id)]));

const questionIds = drawExam(seededRandom(7));
const otherIds = drawExam(seededRandom(8));

/** The text of an export from another device holding `records`. */
const fileText = (records: Partial<Pick<ExportFile, 'answers' | 'exams' | 'flags'>> = {}): string =>
  JSON.stringify({ app: 'cacador', version: 1, exportedAt: T0, answers: [], exams: [], flags: [], ...records });

/** The log as content, without the device-local ids. */
const logContent = async (): Promise<Answer[]> => (await listAnswers()).map(withoutLogId);
const examLog = async (examId: string): Promise<Answer[]> => (await listAnswers()).filter((a) => a.examId === examId);

/** Some progress on this device: practice answers, a finished exam, a running exam and two flags. */
async function makeProgress(): Promise<{ finished: Exam; running: Exam }> {
  for (const [i, id] of [3, 3, 40, 3, 112].entries()) {
    const right = i % 2 === 0;
    await recordAnswer({ questionId: id, chosen: right ? correctOf(id) : wrongOf(id), mode: 'practice', at: T0 + i * MINUTE });
  }
  const finished = await createExam(questionIds, T0 + 10 * MINUTE);
  await answerExam(finished.id, allOf(questionIds.slice(0, 15), correctOf), T0 + 11 * MINUTE);
  await finishExam(finished.id, T0 + 20 * MINUTE);
  const running = await createExam(otherIds, T0 + 22 * MINUTE);
  await answerExam(running.id, allOf(otherIds.slice(0, 2), wrongOf), T0 + 23 * MINUTE);
  await setFlag(3, 'translation', 'says deer', T0 + 5 * MINUTE);
  await setFlag(40, 'hint', '', T0 + 6 * MINUTE);
  return { finished, running: (await getExam(running.id)) as Exam };
}

describe.each([
  ['indexeddb', true],
  ['memory', false],
] as const)('export, import and clear on %s', (mode, available) => {
  beforeEach(async () => {
    // Every read settles the exams past their deadline at the clock's time (D3), and an import refuses a time
    // more than five minutes ahead of it: held where the exams these tests start at T0 to T0 + 22 minutes are
    // all still running and none has started in the future.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0 + 25 * MINUTE);
    await closeStorage();
    vi.stubGlobal('indexedDB', available ? new IDBFactory() : undefined);
    expect(await storageMode()).toBe(mode);
  });

  it('exports the version 1 file: answers without log ids, exams and flags, never question state', async () => {
    await makeProgress();
    const file = await exportProgress(T0 + 2 * 60 * MINUTE);
    expect(Object.keys(file).sort()).toEqual(['answers', 'app', 'exams', 'exportedAt', 'flags', 'version']);
    expect([file.app, file.version, file.exportedAt]).toEqual(['cacador', 1, T0 + 2 * 60 * MINUTE]);
    expect(file.answers).toHaveLength(25);
    expect(file.answers.every((a) => !('id' in a))).toBe(true);
    expect(file.answers.map((a) => a.at)).toEqual([...file.answers.map((a) => a.at)].sort((a, b) => a - b));
    expect(file.exams).toHaveLength(2);
    expect(file.flags).toHaveLength(2);
  });

  it('restores the same answers, exams, flags and states after export, clear and import', async () => {
    await makeProgress();
    const before = { answers: await logContent(), exams: await listExams(), flags: await listFlags(), states: await getStates() };
    const text = JSON.stringify(await exportProgress());

    await clearProgress();
    expect(await listAnswers()).toEqual([]);
    expect(await listExams()).toEqual([]);
    expect(await listFlags()).toEqual([]);
    expect((await getStates()).size).toBe(0);

    expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 25, exams: 2, flags: 2 } });
    expect(await logContent()).toEqual(before.answers);
    expect(await listExams()).toEqual(before.exams);
    expect(await listFlags()).toEqual(before.flags);
    expect(await getStates()).toEqual(before.states);
  });

  it('adds nothing when the same export is imported twice', async () => {
    await makeProgress();
    const text = JSON.stringify(await exportProgress());
    expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 0 } });

    await clearProgress();
    expect(await importProgress(text)).toMatchObject({ ok: true, added: { answers: 25 } });
    const after = { answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() };
    expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 0 } });
    expect({ answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() }).toEqual(after);
  });

  it('merges answers by question and time and rebuilds states from the merged log', async () => {
    await recordAnswer({ questionId: 5, chosen: correctOf(5), mode: 'practice', at: T0 + 2 * MINUTE });
    const file = fileText({
      answers: [
        { questionId: 5, at: T0 + 2 * MINUTE, chosen: correctOf(5), correct: true, mode: 'practice' },
        { questionId: 5, at: T0 + MINUTE, chosen: wrongOf(5), correct: false, mode: 'practice' },
        { questionId: 5, at: T0 + 3 * MINUTE, chosen: correctOf(5), correct: true, mode: 'practice' },
      ],
    });
    expect(await importProgress(file)).toEqual({ ok: true, added: { answers: 2, exams: 0, flags: 0 } });
    expect((await listAnswers()).map((a) => a.at)).toEqual([T0 + MINUTE, T0 + 2 * MINUTE, T0 + 3 * MINUTE]);
    expect((await getStates()).get(5)).toEqual({
      questionId: 5,
      attempts: 3,
      correct: 2,
      streak: 2,
      recent: [false, true, true],
      lastSeenAt: T0 + 3 * MINUTE,
    });
  });

  describe('a second unfinished exam', () => {
    it('submits the file one at the moment of the import when the device started later, never at its deadline still ahead', async () => {
      const own = await createExam(questionIds, T0 + 5 * MINUTE);
      const other: Exam = { id: 'from-laptop', startedAt: T0, questionIds: otherIds, answers: allOf(otherIds.slice(0, 4), correctOf) };
      const text = fileText({ exams: [other] });

      expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 20, exams: 1, flags: 0 } });
      // The clock reads T0 + 25 minutes; the deadline, T0 + 30, has not come.
      const now = T0 + 25 * MINUTE;
      expect(await getExam(other.id)).toEqual({ ...other, finishedAt: now, score: 4 });
      const logged = await examLog(other.id);
      expect(logged).toHaveLength(20);
      expect(logged.every((a) => a.at === now && a.mode === 'exam')).toBe(true);
      expect(logged.filter((a) => !('chosen' in a) && !a.correct)).toHaveLength(16);
      expect((await getStates()).get(otherIds[0] as number)).toMatchObject({ attempts: 1, correct: 1, lastSeenAt: now });
      expect(await getExam(own.id)).toEqual(own);

      // The settled copy now beats the file's unfinished one: nothing more is added or logged.
      expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 0 } });
      expect(await examLog(other.id)).toHaveLength(20);
    });

    it('submits the file one at its deadline once that has passed', async () => {
      await createExam(questionIds, T0 + 5 * MINUTE);
      const other: Exam = { id: 'from-laptop', startedAt: T0 - 10 * MINUTE, questionIds: otherIds, answers: {} };

      expect(await importProgress(fileText({ exams: [other] }))).toMatchObject({ ok: true, added: { answers: 20 } });
      const deadline = T0 - 10 * MINUTE + EXAM_DURATION_MS;
      expect(await getExam(other.id)).toMatchObject({ finishedAt: deadline, score: 0 });
      expect((await examLog(other.id)).every((a) => a.at === deadline)).toBe(true);
    });

    it('submits the device own at the moment of the import when the file one started later', async () => {
      const own = await createExam(questionIds, T0);
      await answerExam(own.id, allOf(questionIds.slice(0, 2), correctOf), T0 + MINUTE);
      const other: Exam = { id: 'from-laptop', startedAt: T0 + 10 * MINUTE, questionIds: otherIds, answers: {} };

      expect(await importProgress(fileText({ exams: [other] }))).toEqual({ ok: true, added: { answers: 20, exams: 1, flags: 0 } });
      expect(await getExam(own.id)).toMatchObject({ finishedAt: T0 + 25 * MINUTE, score: 2 });
      expect(await examLog(own.id)).toHaveLength(20);
      expect(await getExam(other.id)).toEqual(other);
      expect((await listExams()).filter((e) => e.finishedAt === undefined).map((e) => e.id)).toEqual([other.id]);
    });
  });

  describe('two copies of one exam', () => {
    /** The device's exam finished at `finishAt` with every answer right, and the same exam as the file has it. */
    async function deviceExam(finishAt?: number): Promise<Exam> {
      const exam = await createExam(questionIds, T0);
      await answerExam(exam.id, allOf(questionIds.slice(0, 3), correctOf), T0 + MINUTE);
      if (finishAt !== undefined) await finishExam(exam.id, finishAt);
      return (await getExam(exam.id)) as Exam;
    }

    it('keeps the file copy finished earlier, its answers replacing the device ones in the log', async () => {
      const own = await deviceExam(T0 + 20 * MINUTE);
      const theirs = finishExamRecords({ ...own, finishedAt: undefined, score: undefined, answers: allOf(questionIds, wrongOf) }, T0 + 10 * MINUTE);

      const result = await importProgress(fileText({ exams: [theirs.exam], answers: theirs.answers }));
      expect(result).toEqual({ ok: true, added: { answers: 20, exams: 1, flags: 0 } });
      expect(await getExam(own.id)).toMatchObject({ finishedAt: T0 + 10 * MINUTE, score: 0 });
      const logged = await examLog(own.id);
      expect(logged).toHaveLength(20);
      expect(logged.every((a) => a.at === T0 + 10 * MINUTE && !a.correct)).toBe(true);
      expect((await getStates()).get(questionIds[0] as number)).toMatchObject({ attempts: 1, correct: 0, lastSeenAt: T0 + 10 * MINUTE });
    });

    it('keeps the device copy finished earlier and leaves out the file answers to the exam', async () => {
      const own = await deviceExam(T0 + 10 * MINUTE);
      const before = { answers: await listAnswers(), states: await getStates() };
      const theirs = finishExamRecords({ ...own, finishedAt: undefined, score: undefined, answers: {} }, T0 + 20 * MINUTE);

      const result = await importProgress(fileText({ exams: [theirs.exam], answers: theirs.answers }));
      expect(result).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 0 } });
      expect(await getExam(own.id)).toEqual(own);
      expect(await listAnswers()).toEqual(before.answers);
      expect(await getStates()).toEqual(before.states);
    });

    it('keeps a finished copy over an unfinished one, logging its answers once', async () => {
      const own = await deviceExam();
      const theirs = finishExamRecords(own, T0 + 15 * MINUTE);

      const result = await importProgress(fileText({ exams: [theirs.exam], answers: theirs.answers }));
      expect(result).toEqual({ ok: true, added: { answers: 20, exams: 1, flags: 0 } });
      expect(await getExam(own.id)).toEqual(theirs.exam);
      expect(await examLog(own.id)).toHaveLength(20);

      const device = await deviceExam(T0 + 15 * MINUTE);
      expect(await importProgress(fileText({ exams: [{ ...device, finishedAt: undefined, score: undefined }] }))).toMatchObject({
        added: { exams: 0 },
      });
      expect(await getExam(device.id)).toEqual(device);
    });

    it('keeps the unfinished copy with more answers, and the device own on a tie', async () => {
      const own = await deviceExam();
      const more = { ...own, answers: allOf(questionIds.slice(0, 5), wrongOf) };
      expect(await importProgress(fileText({ exams: [more] }))).toEqual({ ok: true, added: { answers: 0, exams: 1, flags: 0 } });
      expect(await getExam(own.id)).toEqual(more);

      const tie = { ...own, answers: allOf(questionIds.slice(10, 15), correctOf) };
      expect(await importProgress(fileText({ exams: [tie] }))).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 0 } });
      expect(await getExam(own.id)).toEqual(more);
      expect(await listAnswers()).toEqual([]);
    });
  });

  it('merges flags by question and kind, keeping the newer', async () => {
    await setFlag(3, 'translation', 'mine', T0 + 2 * MINUTE);
    await setFlag(4, 'hint', 'mine', T0 + 2 * MINUTE);
    const file = fileText({
      flags: [
        { questionId: 3, kind: 'translation', note: 'older', at: T0 + MINUTE },
        { questionId: 4, kind: 'hint', note: 'newer', at: T0 + 3 * MINUTE },
        { questionId: 3, kind: 'hint', note: 'new', at: T0 },
      ],
    });
    expect(await importProgress(file)).toEqual({ ok: true, added: { answers: 0, exams: 0, flags: 2 } });
    expect((await listFlags()).map((f) => `${f.questionId} ${f.kind} ${f.note}`)).toEqual(['4 hint newer', '3 translation mine', '3 hint new']);
  });

  it('works out each answer and exam score from the bank key, not from what the file states', async () => {
    const q = questionIds[0] as number;
    const claimed = finishExamRecords({ id: 'claims-a-pass', startedAt: T0, questionIds, answers: allOf(questionIds, wrongOf) }, T0 + 10 * MINUTE);
    const text = fileText({
      answers: [
        { questionId: 5, at: T0, chosen: wrongOf(5), correct: true, mode: 'practice' },
        ...claimed.answers.map((a) => ({ ...a, correct: true })),
      ],
      exams: [{ ...claimed.exam, score: 20 }],
    });

    expect(await importProgress(text)).toEqual({ ok: true, added: { answers: 21, exams: 1, flags: 0 } });
    expect(await getExam(claimed.exam.id)).toMatchObject({ score: 0 });
    expect((await listAnswers()).every((a) => !a.correct)).toBe(true);
    expect((await getStates()).get(5)).toMatchObject({ attempts: 1, correct: 0, streak: 0 });
    expect((await getStates()).get(q)).toMatchObject({ attempts: 1, correct: 0, streak: 0 });
  });

  it('refuses a file whose exam starts in the future, leaving the running exam on the device alone', async () => {
    const own = await createExam(questionIds, T0 + 20 * MINUTE);
    const before = { answers: await listAnswers(), exams: await listExams(), states: await getStates() };
    const ahead: Exam = { id: 'fast-clock', startedAt: T0 + 31 * MINUTE, questionIds: otherIds, answers: {} };

    expect(await importProgress(fileText({ exams: [ahead] }))).toEqual({ ok: false, reason: 'malformed' });
    expect({ answers: await listAnswers(), exams: await listExams(), states: await getStates() }).toEqual(before);
    expect(await getExam(own.id)).toEqual(own);

    // Within five minutes of the clock it is a clock that runs a little fast, and the newer exam stays the running one.
    const close: Exam = { ...ahead, startedAt: T0 + 30 * MINUTE };
    expect(await importProgress(fileText({ exams: [close] }))).toMatchObject({ ok: true, added: { exams: 1 } });
    expect(await getExam(own.id)).toMatchObject({ finishedAt: T0 + 25 * MINUTE });
  });

  it('refuses a file that is not a version 1 Caçador export and changes nothing', async () => {
    await makeProgress();
    const before = { answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() };
    const good = JSON.parse(fileText({ answers: [{ questionId: 9, at: T0, chosen: 'A', correct: true, mode: 'practice' }] })) as ExportFile;

    expect(await importProgress('{ not json')).toEqual({ ok: false, reason: 'not-json' });
    expect(await importProgress('[]')).toEqual({ ok: false, reason: 'not-cacador' });
    expect(await importProgress(JSON.stringify({ ...good, app: 'sumit' }))).toEqual({ ok: false, reason: 'not-cacador' });
    expect(await importProgress(JSON.stringify({ ...good, version: 2 }))).toEqual({ ok: false, reason: 'unsupported-version' });
    const badLast = { ...good, answers: [...good.answers, { questionId: 9, at: T0, chosen: 'D', correct: true, mode: 'practice' }] };
    expect(await importProgress(JSON.stringify(badLast))).toEqual({ ok: false, reason: 'malformed' });
    expect(await importProgress(JSON.stringify({ ...good, flags: undefined }))).toEqual({ ok: false, reason: 'malformed' });

    expect({ answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() }).toEqual(before);
  });

  it('clears every store and the no-repeat window, never the locale', async () => {
    await makeProgress();
    sessionStorage.setItem(RECENT_KEY, '[1,2,3]');
    localStorage.setItem(LOCALE_KEY, 'pt');

    await clearProgress();
    expect(await listAnswers()).toEqual([]);
    expect(await listExams()).toEqual([]);
    expect(await listFlags()).toEqual([]);
    expect((await getStates()).size).toBe(0);
    expect(sessionStorage.getItem(RECENT_KEY)).toBeNull();
    expect(localStorage.getItem(LOCALE_KEY)).toBe('pt');

    // The stores still work afterwards.
    await recordAnswer({ questionId: 3, chosen: correctOf(3), mode: 'practice', at: T0 });
    expect((await getStates()).get(3)).toMatchObject({ attempts: 1 });
  });
});

describe('import on IndexedDB', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0 + 25 * MINUTE);
  });

  it('is all or nothing: a write that fails leaves every store as it was', async () => {
    await makeProgress();
    const before = { answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() };
    const other: Exam = { id: 'from-laptop', startedAt: T0 + 24 * MINUTE, questionIds: otherIds, answers: {} };
    const text = fileText({
      exams: [other],
      answers: [{ questionId: 9, at: T0, chosen: 'A', correct: true, mode: 'practice' }],
      flags: [{ questionId: 9, kind: 'hint', note: 'x', at: T0 }],
    });

    failStore('put');
    await expect(importProgress(text)).rejects.toThrow('put refused');
    vi.restoreAllMocks();

    expect({ answers: await listAnswers(), exams: await listExams(), flags: await listFlags(), states: await getStates() }).toEqual(before);
  });
});

describe('exportFileName', () => {
  it('names the file by the device date', () => {
    expect(exportFileName(new Date(2026, 9, 3, 23, 59).getTime())).toBe('cacador-progress-2026-10-03.json');
    expect(exportFileName(new Date(2026, 0, 31, 0, 1).getTime())).toBe('cacador-progress-2026-01-31.json');
  });
});
