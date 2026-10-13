import type { Answer, Exam, Flag, FlagKind, OptionKey, QuestionState } from './types';

/** Where progress is kept: IndexedDB, or memory when IndexedDB cannot be opened (nothing is saved, D16). */
export type StorageMode = 'indexeddb' | 'memory';

/**
 * The store operations behind the storage module (D16), implemented on
 * IndexedDB (`idbBackend.ts`) and in memory (`memoryBackend.ts`) with the same
 * behaviour. Each method is one transaction. `index.ts` builds the app's API
 * on top; nothing outside this folder sees a backend.
 */
export interface StorageBackend {
  readonly mode: StorageMode;

  /** Appends an answer and updates its question's state (`nextState`); returns it with its log id. */
  addAnswer(answer: Answer): Promise<Answer>;
  /** The log in time order, from `since` (ms, inclusive) when given. */
  listAnswers(since?: number): Promise<Answer[]>;
  /** One question's answers in time order. */
  listAnswersFor(questionId: number): Promise<Answer[]>;

  getState(questionId: number): Promise<QuestionState | undefined>;
  listStates(): Promise<QuestionState[]>;

  /** Saves a new exam; fails when the id is taken. */
  addExam(exam: Exam): Promise<void>;
  getExam(id: string): Promise<Exam | undefined>;
  listExams(): Promise<Exam[]>;
  /** Replaces the exam's answers while it is running at `now` (`isRunning`); returns whether it did. */
  setExamAnswers(id: string, answers: Record<number, OptionKey>, now: number): Promise<boolean>;
  /**
   * Submits the exam at `at` (`finishExamRecords`): the finished record, its
   * answers logged and their questions' states updated, only while it is
   * still unfinished; returns whether it ran (D3: Submit runs once).
   */
  finishExam(id: string, at: number): Promise<boolean>;

  /** Saves a flag, replacing the one for its question and kind. */
  putFlag(flag: Flag): Promise<void>;
  deleteFlag(questionId: number, kind: FlagKind): Promise<void>;
  getFlags(questionId: number): Promise<Flag[]>;
  listFlags(): Promise<Flag[]>;

  /** Releases the connection; the backend is not used again. */
  close(): void;
}
