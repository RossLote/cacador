import 'fake-indexeddb/auto';
import { questionById, type OptionKey } from '@cacador/data';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawExam, EXAM_DURATION_MS, examDeadline, seededRandom } from '@/model';
import { DB_NAME, DB_VERSION } from './idbBackend';
import {
  closeStorage,
  createExam,
  finishExam,
  getExam,
  getFlags,
  getState,
  getStates,
  getUnfinishedExam,
  listAnswers,
  listAnswersFor,
  listExams,
  listFlags,
  LOCALE_KEY,
  recordAnswer,
  RECENT_KEY,
  removeFlag,
  saveExamAnswers,
  setFlag,
  storageMode,
} from './index';

const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 9, 13, 9, 0);

const correctOf = (id: number): OptionKey => {
  const q = questionById(id);
  if (!q) throw new Error(`no question ${id}`);
  return q.answer;
};
const wrongOf = (id: number): OptionKey => (correctOf(id) === 'A' ? 'B' : 'A');

/** IndexedDB on a fresh fake factory, or no IndexedDB at all. */
function useIndexedDb(available: boolean): void {
  vi.stubGlobal('indexedDB', available ? new IDBFactory() : undefined);
}

afterEach(async () => {
  await closeStorage();
  vi.unstubAllGlobals();
});

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
      const recorded = await recordAnswer({ questionId: 12, chosen: correctOf(12), correct: true, mode: 'practice', at: T0 });
      await recordAnswer({ questionId: 30, chosen: wrongOf(30), correct: false, mode: 'practice', at: T0 + 1000 });
      expect(recorded.id).toEqual(expect.any(Number));

      expect(await listAnswersFor(12)).toEqual([recorded]);
      expect((await listAnswers()).map((a) => a.questionId)).toEqual([12, 30]);
      expect((await listAnswers(T0 + 1)).map((a) => a.questionId)).toEqual([30]);

      expect(await getState(12)).toEqual({ questionId: 12, attempts: 1, correct: 1, streak: 1, recent: [true], lastSeenAt: T0 });
      expect(await getState(1)).toBeUndefined();
      const states = await getStates();
      expect([...states.keys()].sort((a, b) => a - b)).toEqual([12, 30]);
      expect(states.get(30)).toMatchObject({ attempts: 1, correct: 0, streak: 0, recent: [false] });
    });

    it('three right then one wrong leaves streak 0 and recent [true, true, false]', async () => {
      for (const [i, correct] of [true, true, true, false].entries()) {
        await recordAnswer({ questionId: 5, chosen: correct ? correctOf(5) : wrongOf(5), correct, mode: 'practice', at: T0 + i });
      }
      expect(await getState(5)).toEqual({ questionId: 5, attempts: 4, correct: 3, streak: 0, recent: [true, true, false], lastSeenAt: T0 + 3 });
      expect(await listAnswersFor(5)).toHaveLength(4);
    });

    it('accepts an answer with no chosen option and counts it wrong', async () => {
      const recorded = await recordAnswer({ questionId: 8, correct: true, mode: 'exam', examId: 'x', at: T0 });
      expect(recorded).toMatchObject({ questionId: 8, correct: false });
      expect('chosen' in recorded).toBe(false);
      expect(await getState(8)).toMatchObject({ attempts: 1, correct: 0, streak: 0, recent: [false] });
    });

    it('stamps an answer with the current time when none is given', async () => {
      const before = Date.now();
      const recorded = await recordAnswer({ questionId: 9, chosen: 'A', correct: false, mode: 'practice' });
      expect(recorded.at).toBeGreaterThanOrEqual(before);
    });
  });

  describe('exams', () => {
    const questionIds = drawExam(seededRandom(4));

    it('creates an exam and saves answers only while it runs', async () => {
      const exam = await createExam(questionIds, T0);
      expect(exam).toEqual({ id: expect.any(String), startedAt: T0, questionIds, answers: {} });
      expect(await getExam(exam.id)).toEqual(exam);

      const first = questionIds[0] as number;
      expect(await saveExamAnswers(exam.id, { [first]: 'B' }, T0 + MINUTE)).toBe(true);
      expect((await getExam(exam.id))?.answers).toEqual({ [first]: 'B' });
      expect(await saveExamAnswers(exam.id, { [first]: 'C' }, examDeadline(exam))).toBe(false);
      expect(await saveExamAnswers('missing', {}, T0)).toBe(false);

      expect(await finishExam(exam.id, T0 + 2 * MINUTE)).toBe(true);
      expect(await saveExamAnswers(exam.id, { [first]: 'C' }, T0 + 3 * MINUTE)).toBe(false);
      expect((await getExam(exam.id))?.answers).toEqual({ [first]: 'B' });
    });

    it('finishes an exam once: the second call does nothing and reports it', async () => {
      const exam = await createExam(questionIds, T0);
      const answers = Object.fromEntries(questionIds.slice(0, 16).map((id) => [id, correctOf(id)]));
      await saveExamAnswers(exam.id, answers, T0 + MINUTE);

      expect(await finishExam(exam.id, T0 + 10 * MINUTE)).toBe(true);
      expect(await finishExam(exam.id, T0 + 11 * MINUTE)).toBe(false);
      expect(await finishExam('missing', T0)).toBe(false);

      expect(await getExam(exam.id)).toMatchObject({ finishedAt: T0 + 10 * MINUTE, score: 16 });
      const logged = await listAnswers();
      expect(logged).toHaveLength(20);
      expect(logged.every((a) => a.mode === 'exam' && a.examId === exam.id && a.at === T0 + 10 * MINUTE)).toBe(true);
      const first = questionIds[0] as number;
      expect(await getState(first)).toMatchObject({ attempts: 1, correct: 1, streak: 1, lastSeenAt: T0 + 10 * MINUTE });
      const last = questionIds[19] as number;
      expect(await getState(last)).toMatchObject({ attempts: 1, correct: 0, streak: 0 });
    });

    it('settles an exam past its deadline when the unfinished exam is asked for', async () => {
      const exam = await createExam(questionIds, T0);
      const answered = questionIds.slice(0, 12);
      await saveExamAnswers(exam.id, Object.fromEntries(answered.map((id) => [id, correctOf(id)])), T0 + MINUTE);

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

    it('keeps a question state equal to its log when a settled exam lands before later practice', async () => {
      const exam = await createExam(questionIds, T0);
      const id = questionIds[0] as number;
      await saveExamAnswers(exam.id, { [id]: wrongOf(id) }, T0 + MINUTE);
      await recordAnswer({ questionId: id, chosen: correctOf(id), correct: true, mode: 'practice', at: T0 + 45 * MINUTE });

      expect(await getUnfinishedExam(T0 + 50 * MINUTE)).toBeUndefined();

      // The exam's wrong answer at 30:00 comes before the practice answer at 45:00.
      expect(await getState(id)).toEqual({
        questionId: id,
        attempts: 2,
        correct: 1,
        streak: 1,
        recent: [false, true],
        lastSeenAt: T0 + 45 * MINUTE,
      });
      expect((await listAnswersFor(id)).map((a) => a.mode)).toEqual(['exam', 'practice']);
    });

    it('returns the running exam, the newest when there are several, and lists exams newest first', async () => {
      expect(await getUnfinishedExam(T0)).toBeUndefined();
      const older = await createExam(questionIds, T0);
      const newer = await createExam(questionIds, T0 + 5 * MINUTE);
      expect(await getUnfinishedExam(T0 + 10 * MINUTE)).toEqual(newer);
      expect((await listExams()).map((e) => e.id)).toEqual([newer.id, older.id]);

      // 32 minutes on, the older is past its deadline and settled; the newer still runs.
      expect(await getUnfinishedExam(T0 + 32 * MINUTE)).toEqual(newer);
      expect((await getExam(older.id))?.finishedAt).toBe(examDeadline(older));
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
  beforeEach(async () => {
    await closeStorage();
    useIndexedDb(true);
  });

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
    await recordAnswer({ questionId: 3, chosen: correctOf(3), correct: true, mode: 'practice', at: T0 });
    await setFlag(3, 'hint', 'x', T0);
    await closeStorage();
    expect(await getState(3)).toMatchObject({ attempts: 1 });
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
  beforeEach(async () => {
    await closeStorage();
  });

  it('serves from memory when IndexedDB refuses to open, and stays there', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.stubGlobal('indexedDB', factory);
    expect(await storageMode()).toBe('memory');
    await recordAnswer({ questionId: 2, chosen: 'A', correct: true, mode: 'practice', at: T0 });

    vi.stubGlobal('indexedDB', new IDBFactory());
    expect(await storageMode()).toBe('memory');
    expect(await getState(2)).toMatchObject({ attempts: 1 });
  });
});

describe('browser keys', () => {
  it('names the two Web Storage keys', () => {
    expect(LOCALE_KEY).toBe('cacador.locale');
    expect(RECENT_KEY).toBe('cacador.recent');
  });
});
