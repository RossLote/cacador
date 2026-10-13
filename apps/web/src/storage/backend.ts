import type { ProgressRecords } from './exportFile';
import type { ImportCounts } from './merge';
import type { Answer, Exam, ExportFile, Flag, FlagKind, OptionKey, QuestionState } from './types';

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
  listStates(): Promise<QuestionState[]>;

  /**
   * Saves `exam` as the new unfinished exam unless one is already running at
   * its `startedAt` (`runningExam`), in which case nothing is written and that
   * one is returned; otherwise returns `exam`. Fails when the id is taken.
   */
  startExam(exam: Exam): Promise<Exam>;
  getExam(id: string): Promise<Exam | undefined>;
  listExams(): Promise<Exam[]>;
  /**
   * Sets one question's option on the stored exam, leaving its other answers as
   * stored, while it is running at `at` (`isRunning`) and only for one of its
   * questions; returns whether it did.
   */
  setExamAnswer(id: string, questionId: number, option: OptionKey, at: number): Promise<boolean>;
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

  /** Every answer (in log order), exam and flag, read together, for the export (D8). */
  readAll(): Promise<ProgressRecords>;
  /**
   * Merges a validated export into the stores (`planImport`, at `now`) and
   * rebuilds every question state from the merged log, all or nothing; returns
   * what it added (D8).
   */
  importFile(file: ExportFile, now: number): Promise<ImportCounts>;
  /** Empties every store (D8: Clear progress). */
  clear(): Promise<void>;

  /** Releases the connection; the backend is not used again. */
  close(): void;
}
