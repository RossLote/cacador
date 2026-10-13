import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawExam, EXAM_DURATION_MS, examDeadline, seededRandom } from '@/model';
import { DB_NAME, DB_VERSION } from './idbBackend';
import {
  closeStorage,
  createExam,
  exportProgress,
  finishExam,
  getExam,
  getFlags,
  getStates,
  getUnfinishedExam,
  listAnswers,
  listExams,
  listFlags,
  LOCALE_KEY,
  recordAnswer,
  RECENT_KEY,
  removeFlag,
  saveExamAnswer,
  setFlag,
  storageMode,
} from './index';
import { correctOf, wrongOf } from '../../test/fixtures';
import { answerExam } from '../../test/storage';

const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 9, 13, 9, 0);

/** One question's state, as the app reads states. */
const stateOf = async (questionId: number) => (await getStates()).get(questionId);
/** One question's answers in time order, as the app reads the log. */
const answersFor = async (questionId: number) => (await listAnswers()).filter((a) => a.questionId === questionId);

/** IndexedDB on a fresh fake factory, or no IndexedDB at all. */
function useIndexedDb(available: boolean): void {
  vi.stubGlobal('indexedDB', available ? new IDBFactory() : undefined);
}

describe.each([
  ['indexeddb', true],
  ['memory', false],
] as const)('storage on %s', (mode, available) => {
  beforeEach(async () => {
    await closeStorage();
    useIndexedDb(available);
  });

  it(`reports ${mode}`, async () => {
    expect(await storageMode()).toBe(mode);
  });

  describe('answers and state', () => {
    it('logs an answer by question and by time and derives its state', async () => {
      const recorded = await recordAnswer({ questionId: 12, chosen: correctOf(12), mode: 'practice', at: T0 });
      await recordAnswer({ questionId: 30, chosen: wrongOf(30), mode: 'practice', at: T0 + 1000 });
      expect(recorded.id).toEqual(expect.any(Number));

      expect(await answersFor(12)).toEqual([recorded]);
      expect((await listAnswers()).map((a) => a.questionId)).toEqual([12, 30]);
      expect((await listAnswers(T0 + 1)).map((a) => a.questionId)).toEqual([30]);

      expect(await stateOf(12)).toEqual({ questionId: 12, attempts: 1, correct: 1, streak: 1, recent: [true], lastSeenAt: T0 });
      expect(await stateOf(1)).toBeUndefined();
      const states = await getStates();
      expect([...states.keys()].sort((a, b) => a - b)).toEqual([12, 30]);
      expect(states.get(30)).toMatchObject({ attempts: 1, correct: 0, streak: 0, recent: [false] });
    });

    it('three right then one wrong leaves streak 0 and recent [true, true, false]', async () => {
      for (const [i, correct] of [true, true, true, false].entries()) {
        await recordAnswer({ questionId: 5, chosen: correct ? correctOf(5) : wrongOf(5), mode: 'practice', at: T0 + i });
      }
      expect(await stateOf(5)).toEqual({ questionId: 5, attempts: 4, correct: 3, streak: 0, recent: [true, true, false], lastSeenAt: T0 + 3 });
      expect(await answersFor(5)).toHaveLength(4);
    });

    it('accepts an exam answer with no chosen option, wrong, and counts it', async () => {
      const recorded = await recordAnswer({ questionId: 8, mode: 'exam', examId: 'x', at: T0 });
      expect(recorded).toMatchObject({ questionId: 8, correct: false });
      expect('chosen' in recorded).toBe(false);
      expect(await stateOf(8)).toMatchObject({ attempts: 1, correct: 0, streak: 0, recent: [false] });
    });

    it.each([
      ['a practice answer with no chosen option', { mode: 'practice' }],
      ['a practice answer naming an exam', { mode: 'practice', chosen: 'A', examId: 'x' }],
      ['an exam answer naming no exam', { mode: 'exam', chosen: 'A' }],
    ] as const)('refuses %s and writes nothing', async (_, fields) => {
      await expect(recordAnswer({ questionId: 8, at: T0, ...fields })).rejects.toThrow('Not a well-formed answer');
      expect(await listAnswers()).toEqual([]);
      expect(await stateOf(8)).toBeUndefined();
    });

    it('stamps an answer with the current time when none is given', async () => {
      const before = Date.now();
      const recorded = await recordAnswer({ questionId: 9, chosen: 'A', mode: 'practice' });
      expect(recorded.at).toBeGreaterThanOrEqual(before);
    });
  });

  describe('exams', () => {
    const questionIds = drawExam(seededRandom(4));

    // Every read settles the exams past their deadline at the clock's time (D3), so the clock is held at T0.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(T0);
    });

    it('creates an exam with no answers', async () => {
      const exam = await createExam(questionIds, T0);
      expect(exam).toEqual({ id: expect.any(String), startedAt: T0, questionIds, answers: {} });
      expect(await getExam(exam.id)).toEqual(exam);
    });

    it('finishes an exam once: the second call does nothing and reports it', async () => {
      const exam = await createExam(questionIds, T0);
      const answers = Object.fromEntries(questionIds.slice(0, 16).map((id) => [id, correctOf(id)]));
      await answerExam(exam.id, answers, T0 + MINUTE);

      expect(await finishExam(exam.id, T0 + 10 * MINUTE)).toBe(true);
      expect(await finishExam(exam.id, T0 + 11 * MINUTE)).toBe(false);
      expect(await finishExam('missing', T0)).toBe(false);

      expect(await getExam(exam.id)).toMatchObject({ finishedAt: T0 + 10 * MINUTE, score: 16 });
      const logged = await listAnswers();
      expect(logged).toHaveLength(20);
      expect(logged.every((a) => a.mode === 'exam' && a.examId === exam.id && a.at === T0 + 10 * MINUTE)).toBe(true);
      const first = questionIds[0] as number;
      expect(await stateOf(first)).toMatchObject({ attempts: 1, correct: 1, streak: 1, lastSeenAt: T0 + 10 * MINUTE });
      const last = questionIds[19] as number;
      expect(await stateOf(last)).toMatchObject({ attempts: 1, correct: 0, streak: 0 });
    });

    it('settles an exam past its deadline when the unfinished exam is asked for', async () => {
      const exam = await createExam(questionIds, T0);
      const answered = questionIds.slice(0, 12);
      await answerExam(exam.id, Object.fromEntries(answered.map((id) => [id, correctOf(id)])), T0 + MINUTE);

      expect(await getUnfinishedExam(T0 + 31 * MINUTE)).toBeUndefined();

      const deadline = T0 + EXAM_DURATION_MS;
      expect(await getExam(exam.id)).toMatchObject({ finishedAt: deadline, score: 12 });
      const logged = await listAnswers();
      expect(logged).toHaveLength(20);
      expect(logged.every((a) => a.at === deadline && a.mode === 'exam' && a.examId === exam.id)).toBe(true);
      const unanswered = logged.filter((a) => !answered.includes(a.questionId));
      expect(unanswered).toHaveLength(8);
      expect(unanswered.every((a) => !('chosen' in a) && !a.correct)).toBe(true);
      expect(logged.filter((a) => a.correct)).toHaveLength(12);

      // Asking again changes nothing.
      expect(await getUnfinishedExam(T0 + 40 * MINUTE)).toBeUndefined();
      expect(await listAnswers()).toHaveLength(20);
    });

    it.each([
      ['the states', async () => (await getStates()).size === 20],
      ['the log', async () => (await listAnswers()).length === 20],
      ['the exams', async () => (await listExams())[0]?.finishedAt === T0 + EXAM_DURATION_MS],
      ['the export', async () => (await exportProgress()).exams[0]?.finishedAt === T0 + EXAM_DURATION_MS],
    ])('settles an exam past its deadline before reading %s', async (_, readSeesItSettled) => {
      const exam = await createExam(questionIds, T0);
      vi.setSystemTime(T0 + 31 * MINUTE);
      expect(await readSeesItSettled()).toBe(true);
      expect(await getExam(exam.id)).toMatchObject({ finishedAt: T0 + EXAM_DURATION_MS, score: 0 });
    });

    it('settles an exam past its deadline before reading it by id', async () => {
      const exam = await createExam(questionIds, T0);
      vi.setSystemTime(T0 + 31 * MINUTE);
      expect(await getExam(exam.id)).toMatchObject({ finishedAt: T0 + EXAM_DURATION_MS, score: 0 });
    });

    it('keeps a question state equal to its log when a settled exam lands before later practice', async () => {
      const exam = await createExam(questionIds, T0);
      const id = questionIds[0] as number;
      expect(await saveExamAnswer(exam.id, id, wrongOf(id), T0 + MINUTE)).toBe(true);
      await recordAnswer({ questionId: id, chosen: correctOf(id), mode: 'practice', at: T0 + 45 * MINUTE });

      expect(await getUnfinishedExam(T0 + 50 * MINUTE)).toBeUndefined();

      // The exam's wrong answer at 30:00 comes before the practice answer at 45:00.
      expect(await stateOf(id)).toEqual({
        questionId: id,
        attempts: 2,
        correct: 1,
        streak: 1,
        recent: [false, true],
        lastSeenAt: T0 + 45 * MINUTE,
      });
      expect((await answersFor(id)).map((a) => a.mode)).toEqual(['exam', 'practice']);
    });

    it('returns the running exam and lists exams newest first', async () => {
      expect(await getUnfinishedExam(T0)).toBeUndefined();
      const older = await createExam(questionIds, T0);
      await finishExam(older.id, T0 + MINUTE);
      const newer = await createExam(questionIds, T0 + 5 * MINUTE);
      expect(await getUnfinishedExam(T0 + 10 * MINUTE)).toEqual(newer);
      expect((await listExams()).map((e) => e.id)).toEqual([newer.id, older.id]);
    });

    it('starts no second exam while one runs: a stale start screen gets the running one back to resume', async () => {
      const running = await createExam(questionIds, T0);
      const first = questionIds[0] as number;
      await saveExamAnswer(running.id, first, 'B', T0 + MINUTE);

      const again = await createExam(drawExam(seededRandom(9)), T0 + 2 * MINUTE);
      expect(again).toEqual({ ...running, answers: { [first]: 'B' } });
      expect(await listExams()).toHaveLength(1);

      // Two starts at once still make one exam.
      const [a, b] = await Promise.all([createExam(questionIds, T0 + 3 * MINUTE), createExam(questionIds, T0 + 3 * MINUTE)]);
      expect([a.id, b.id]).toEqual([running.id, running.id]);
      expect(await listExams()).toHaveLength(1);
    });

    it('settles an exam past its deadline before starting a new one', async () => {
      const stale = await createExam(questionIds, T0);
      vi.setSystemTime(T0 + 31 * MINUTE);
      const fresh = await createExam(questionIds, T0 + 31 * MINUTE);
      expect(fresh.id).not.toBe(stale.id);
      expect(fresh).toMatchObject({ startedAt: T0 + 31 * MINUTE, answers: {} });
      expect(await getExam(stale.id)).toMatchObject({ finishedAt: examDeadline(stale), score: 0 });
      expect(await getUnfinishedExam(T0 + 31 * MINUTE)).toEqual(fresh);
    });

    it('saves one answer at a time, merged into the stored answers, so two screens on one exam keep both', async () => {
      const exam = await createExam(questionIds, T0);
      const [q1, q2] = questionIds as [number, number];
      // Two screens loaded the exam with no answers; each saves its own question.
      expect(await saveExamAnswer(exam.id, q1, 'A', T0 + MINUTE)).toBe(true);
      expect(await saveExamAnswer(exam.id, q2, 'C', T0 + MINUTE)).toBe(true);
      expect((await getExam(exam.id))?.answers).toEqual({ [q1]: 'A', [q2]: 'C' });

      // A change replaces that question's option only.
      expect(await saveExamAnswer(exam.id, q1, 'B', T0 + 2 * MINUTE)).toBe(true);
      expect((await getExam(exam.id))?.answers).toEqual({ [q1]: 'B', [q2]: 'C' });
    });

    it('refuses an answer chosen after the deadline, to a finished exam, to a question not in it, or to no exam', async () => {
      const exam = await createExam(questionIds, T0);
      const first = questionIds[0] as number;
      const outside = [1, 2, 3, 4].find((id) => !questionIds.includes(id)) as number;

      // Judged by when it was chosen, not when the write lands.
      expect(await saveExamAnswer(exam.id, first, 'A', examDeadline(exam) - 1)).toBe(true);
      expect(await saveExamAnswer(exam.id, first, 'B', examDeadline(exam))).toBe(false);
      expect(await saveExamAnswer(exam.id, outside, 'A', T0 + MINUTE)).toBe(false);
      expect(await saveExamAnswer('missing', first, 'A', T0 + MINUTE)).toBe(false);
      expect((await getExam(exam.id))?.answers).toEqual({ [first]: 'A' });

      await finishExam(exam.id, T0 + 2 * MINUTE);
      expect(await saveExamAnswer(exam.id, first, 'C', T0 + 3 * MINUTE)).toBe(false);
      expect((await getExam(exam.id))?.answers).toEqual({ [first]: 'A' });
    });
  });

  describe('flags', () => {
    it('keeps one flag per question and kind, the newer note winning', async () => {
      await setFlag(40, 'translation', '', T0);
      await setFlag(40, 'translation', 'says deer, means boar', T0 + 1000);
      expect(await getFlags(40)).toEqual([{ questionId: 40, kind: 'translation', note: 'says deer, means boar', at: T0 + 1000 }]);
    });

    it('reads a question flags, lists every flag newest first and clears one', async () => {
      await setFlag(40, 'translation', 'a', T0);
      await setFlag(40, 'hint', 'b', T0 + 2000);
      await setFlag(41, 'hint', 'c', T0 + 1000);
      await setFlag(400, 'hint', 'd', T0 + 3000);

      expect((await getFlags(40)).map((f) => f.kind).sort()).toEqual(['hint', 'translation']);
      expect(await getFlags(4)).toEqual([]);
      expect((await listFlags()).map((f) => f.note)).toEqual(['d', 'b', 'c', 'a']);

      await removeFlag(40, 'hint');
      expect((await getFlags(40)).map((f) => f.kind)).toEqual(['translation']);
      expect(await listFlags()).toHaveLength(3);
    });
  });
});

describe('IndexedDB', () => {
  it('opens database cacador version 1 with the four stores and their keys and indexes', async () => {
    await storageMode();
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(['answers', 'questionState', 'exams', 'flags']);
    const answers = tx.objectStore('answers');
    expect([db.name, db.version]).toEqual(['cacador', 1]);
    expect([...db.objectStoreNames].sort()).toEqual(['answers', 'exams', 'flags', 'questionState']);
    expect([answers.keyPath, answers.autoIncrement]).toEqual(['id', true]);
    expect([...answers.indexNames].sort()).toEqual(['at', 'questionId']);
    expect(tx.objectStore('questionState').keyPath).toBe('questionId');
    expect(tx.objectStore('exams').keyPath).toBe('id');
    expect(tx.objectStore('flags').keyPath).toEqual(['questionId', 'kind']);
    db.close();
  });

  it('keeps progress across a reopen', async () => {
    await recordAnswer({ questionId: 3, chosen: correctOf(3), mode: 'practice', at: T0 });
    await setFlag(3, 'hint', 'x', T0);
    await closeStorage();
    expect(await stateOf(3)).toMatchObject({ attempts: 1 });
    expect(await listFlags()).toHaveLength(1);
  });

  it('asks for persistent storage once, on the first open', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { ...navigator, storage: { persist } });
    await Promise.all([storageMode(), listAnswers(), getStates()]);
    await listFlags();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('opens without a storage manager', async () => {
    vi.stubGlobal('navigator', {});
    expect(await storageMode()).toBe('indexeddb');
  });

  it('does not ask for persistence when it falls back to memory', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { storage: { persist } });
    useIndexedDb(false);
    expect(await storageMode()).toBe('memory');
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('memory fallback', () => {
  it('serves from memory when IndexedDB refuses to open, and stays there', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.stubGlobal('indexedDB', factory);
    expect(await storageMode()).toBe('memory');
    await recordAnswer({ questionId: 2, chosen: correctOf(2), mode: 'practice', at: T0 });

    vi.stubGlobal('indexedDB', new IDBFactory());
    expect(await storageMode()).toBe('memory');
    expect(await stateOf(2)).toMatchObject({ attempts: 1 });
  });
});

describe('browser keys', () => {
  it('names the two Web Storage keys', () => {
    expect(LOCALE_KEY).toBe('cacador.locale');
    expect(RECENT_KEY).toBe('cacador.recent');
  });
});
