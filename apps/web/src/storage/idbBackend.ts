import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { StorageBackend } from './backend';
import { finishExamRecords, isRunning } from './finish';
import { planImport } from './merge';
import { compareAnswers, isInOrder, nextState, withoutLogId } from './state';
import type { Answer, Exam, Flag, FlagKind, QuestionState } from './types';

/** The database (D16). A new store or index is a new version with its own upgrade step. */
export const DB_NAME = 'cacador';
export const DB_VERSION = 1;

const STORES = ['answers', 'questionState', 'exams', 'flags'] as const;

export interface CacadorDB extends DBSchema {
  answers: { key: number; value: Answer; indexes: { questionId: number; at: number } };
  questionState: { key: number; value: QuestionState };
  exams: { key: string; value: Exam };
  flags: { key: [number, FlagKind]; value: Flag };
}

type Store = StoreNames<CacadorDB>;
type WriteTx = IDBPTransaction<CacadorDB, Store[], 'readwrite'>;

/** Opens (creating on first use) the database; rejects when IndexedDB is missing or refuses. */
export async function openIdbBackend(): Promise<StorageBackend> {
  const db = await openDB<CacadorDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const answers = database.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
      answers.createIndex('questionId', 'questionId');
      answers.createIndex('at', 'at');
      database.createObjectStore('questionState', { keyPath: 'questionId' });
      database.createObjectStore('exams', { keyPath: 'id' });
      database.createObjectStore('flags', { keyPath: ['questionId', 'kind'] });
    },
  });
  return idbBackend(db);
}

/**
 * Runs `work` in one read-write transaction over `stores` and resolves once it
 * has committed. A throw inside `work` aborts the transaction, so nothing it
 * wrote is kept.
 */
async function write<T>(db: IDBPDatabase<CacadorDB>, stores: Store[], work: (tx: WriteTx) => Promise<T>): Promise<T> {
  const tx = db.transaction(stores, 'readwrite');
  const run = work(tx).catch((error: unknown) => {
    try {
      tx.abort();
    } catch {
      // Already aborted by the failed request.
    }
    throw error;
  });
  const [result] = await Promise.all([run, tx.done]);
  return result;
}

/** Appends `answer` to the log and updates its question's state, inside `tx`. */
async function appendAnswer(tx: WriteTx, answer: Answer): Promise<Answer> {
  const record = withoutLogId(answer);
  const id = await tx.objectStore('answers').add(record);
  const stored: Answer = { ...record, id };
  const states = tx.objectStore('questionState');
  const state = await states.get(answer.questionId);
  const log = isInOrder(state, stored) ? [] : await tx.objectStore('answers').index('questionId').getAll(answer.questionId);
  await states.put(nextState(state, stored, () => log));
  return stored;
}

function idbBackend(db: IDBPDatabase<CacadorDB>): StorageBackend {
  return {
    mode: 'indexeddb',

    addAnswer: (answer) => write(db, ['answers', 'questionState'], (tx) => appendAnswer(tx, answer)),
    listAnswers: (since) => db.getAllFromIndex('answers', 'at', since === undefined ? undefined : IDBKeyRange.lowerBound(since)),
    listAnswersFor: async (questionId) => (await db.getAllFromIndex('answers', 'questionId', questionId)).sort(compareAnswers),

    getState: (questionId) => db.get('questionState', questionId),
    listStates: () => db.getAll('questionState'),

    addExam: async (exam) => {
      await db.add('exams', exam);
    },
    getExam: (id) => db.get('exams', id),
    listExams: () => db.getAll('exams'),
    setExamAnswers: (id, answers, now) =>
      write(db, ['exams'], async (tx) => {
        const exams = tx.objectStore('exams');
        const exam = await exams.get(id);
        if (exam === undefined || !isRunning(exam, now)) return false;
        await exams.put({ ...exam, answers: { ...answers } });
        return true;
      }),
    finishExam: (id, at) =>
      write(db, ['exams', 'answers', 'questionState'], async (tx) => {
        const exams = tx.objectStore('exams');
        const exam = await exams.get(id);
        if (exam === undefined || exam.finishedAt !== undefined) return false;
        const finished = finishExamRecords(exam, at);
        await exams.put(finished.exam);
        for (const answer of finished.answers) await appendAnswer(tx, answer);
        return true;
      }),

    putFlag: async (flag) => {
      await db.put('flags', flag);
    },
    deleteFlag: (questionId, kind) => db.delete('flags', [questionId, kind]),
    // Keys are [questionId, kind]: [q] sorts before every [q, kind] and [q, []] after them.
    getFlags: (questionId) => db.getAll('flags', IDBKeyRange.bound([questionId], [questionId, []])),
    listFlags: () => db.getAll('flags'),

    readAll: async () => {
      const tx = db.transaction(['answers', 'exams', 'flags']);
      const [answers, exams, flags] = await Promise.all([
        tx.objectStore('answers').getAll(),
        tx.objectStore('exams').getAll(),
        tx.objectStore('flags').getAll(),
        tx.done,
      ]);
      return { answers: answers.sort(compareAnswers), exams, flags };
    },
    importFile: (file) =>
      write(db, [...STORES], async (tx) => {
        const answers = tx.objectStore('answers');
        const exams = tx.objectStore('exams');
        const flags = tx.objectStore('flags');
        const states = tx.objectStore('questionState');
        const [deviceAnswers, deviceExams, deviceFlags] = await Promise.all([answers.getAll(), exams.getAll(), flags.getAll()]);
        const plan = planImport({ answers: deviceAnswers, exams: deviceExams, flags: deviceFlags }, file);
        // One request at a time, so a failing one rejects here and aborts the lot with no request left unawaited.
        for (const id of plan.removeAnswerIds) await answers.delete(id);
        for (const answer of plan.addAnswers) await answers.add(withoutLogId(answer));
        for (const exam of plan.putExams) await exams.put(exam);
        for (const flag of plan.putFlags) await flags.put(flag);
        await states.clear();
        for (const state of plan.states) await states.put(state);
        return plan.added;
      }),
    clear: () =>
      write(db, [...STORES], async (tx) => {
        for (const store of STORES) await tx.objectStore(store).clear();
      }),

    close: () => db.close(),
  };
}
