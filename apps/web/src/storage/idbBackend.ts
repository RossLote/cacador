import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { StorageBackend } from './backend';
import { finishExamRecords, isRunning } from './finish';
import { compareAnswers, isInOrder, nextState } from './state';
import type { Answer, Exam, Flag, FlagKind, QuestionState } from './types';

/** The database (D16). A new store or index is a new version with its own upgrade step. */
export const DB_NAME = 'cacador';
export const DB_VERSION = 1;

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
  const record: Answer = { ...answer };
  delete record.id;
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

    close: () => db.close(),
  };
}
