/**
 * The storage module (phase 4 D16, DESIGN.md § 7): the one place the app
 * records and reads progress, and the only importer of IndexedDB. Every screen
 * goes through these functions. The database opens lazily on the first call;
 * when IndexedDB cannot be opened the same API runs in memory for the rest of
 * the page's life and `storageMode()` reports `memory`, nothing being saved.
 */
import { examDeadline, indexStates, type StateMap } from '@/model';
import type { StorageBackend, StorageMode } from './backend';
import { readExportFile, toExportFile, type ExportRefusal } from './exportFile';
import { isRunning } from './finish';
import { openIdbBackend } from './idbBackend';
import { RECENT_KEY } from './keys';
import type { ImportCounts } from './merge';
import { createMemoryBackend } from './memoryBackend';
import type { Answer, AnswerMode, Exam, ExportFile, Flag, FlagKind, OptionKey } from './types';

export { LOCALE_KEY, RECENT_KEY } from './keys';
export { exportFileName } from './exportFile';
export type { ImportCounts } from './merge';
export { FLAG_KINDS, OPTION_KEYS } from './types';
export type { Answer, Exam, ExportFile, Flag, FlagKind, OptionKey, QuestionState } from './types';

let opening: Promise<StorageBackend> | undefined;

/** Asks the browser to keep this origin's storage under pressure (D12); absent in some browsers and in jsdom. */
function requestPersistence(): void {
  const storage = globalThis.navigator?.storage as StorageManager | undefined;
  storage?.persist?.().catch(() => {
    // Refused or unsupported: storage stays best-effort.
  });
}

async function open(): Promise<StorageBackend> {
  try {
    const backend = await openIdbBackend();
    requestPersistence();
    return backend;
  } catch {
    return createMemoryBackend();
  }
}

/** The backend, opening it on first use; a failed open falls back to memory once and stays there. */
function backend(): Promise<StorageBackend> {
  opening ??= open();
  return opening;
}

/** Where progress is kept: `indexeddb`, or `memory` when nothing is being saved (for Settings, D16). */
export async function storageMode(): Promise<StorageMode> {
  return (await backend()).mode;
}

/** Closes the database and forgets it; the next call opens it again. */
export async function closeStorage(): Promise<void> {
  const current = opening;
  opening = undefined;
  if (current !== undefined) (await current).close();
}

// Answers and question state

/** An answer to record: the log id is assigned on insert. */
export interface NewAnswer {
  questionId: number;
  /** The option picked; leave out for an exam question left unanswered (D15). */
  chosen?: OptionKey;
  correct: boolean;
  mode: AnswerMode;
  examId?: string;
  /** ms since the epoch; now when left out. */
  at?: number;
}

/**
 * Appends an answer to the log and updates its question's state, in one
 * transaction; returns it with its id. An answer with no chosen option counts
 * wrong whatever `correct` says.
 */
export async function recordAnswer(answer: NewAnswer): Promise<Answer> {
  const correct = answer.chosen !== undefined && answer.correct;
  return (await backend()).addAnswer({ ...answer, correct, at: answer.at ?? Date.now() });
}

/** The answers log in time order, from `since` (ms, inclusive) when given. */
export async function listAnswers(since?: number): Promise<Answer[]> {
  return (await backend()).listAnswers(since);
}

/** Every seen question's state by id, for the model's draw and readiness. */
export async function getStates(): Promise<StateMap> {
  return indexStates(await (await backend()).listStates());
}

// Exams (D3)

/** Saves a new unfinished exam over the drawn `questionIds` (the model's drawExam) and returns it. */
export async function createExam(questionIds: readonly number[], startedAt: number = Date.now()): Promise<Exam> {
  const exam: Exam = { id: crypto.randomUUID(), startedAt, questionIds: [...questionIds], answers: {} };
  await (await backend()).addExam(exam);
  return exam;
}

/** Replaces a running exam's answers; false once it is finished or past its deadline at `now`. */
export async function saveExamAnswers(id: string, answers: Record<number, OptionKey>, now: number = Date.now()): Promise<boolean> {
  return (await backend()).setExamAnswers(id, answers, now);
}

/**
 * Submits an exam as it stands (Submit and the 30:00 auto-submit, D3): it is
 * marked finished with its score, and each of its questions is logged (mode
 * exam, unanswered ones with no chosen option and wrong) and counted in its
 * state, in one transaction. `at` is held to the deadline. Runs only while the
 * exam is unfinished and returns whether it ran, so a second Submit does
 * nothing.
 */
export async function finishExam(id: string, at: number = Date.now()): Promise<boolean> {
  return (await backend()).finishExam(id, at);
}

export async function getExam(id: string): Promise<Exam | undefined> {
  return (await backend()).getExam(id);
}

/** Every exam, finished or not, newest started first. */
export async function listExams(): Promise<Exam[]> {
  return (await (await backend()).listExams()).sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * The exam in progress, or undefined. Any unfinished exam past its deadline is
 * first settled: submitted as it stands at the deadline (D3). Should more than
 * one still be running, the most recently started is the one returned.
 */
export async function getUnfinishedExam(now: number = Date.now()): Promise<Exam | undefined> {
  const store = await backend();
  const exams = await listExams();
  for (const exam of exams) {
    if (exam.finishedAt === undefined && !isRunning(exam, now)) await store.finishExam(exam.id, examDeadline(exam));
  }
  return exams.find((exam) => isRunning(exam, now));
}

// Flags (D2)

/** Sets the question's flag of this kind with `note`, replacing any earlier one (one per question and kind). */
export async function setFlag(questionId: number, kind: FlagKind, note = '', at: number = Date.now()): Promise<Flag> {
  const flag: Flag = { questionId, kind, note, at };
  await (await backend()).putFlag(flag);
  return flag;
}

export async function removeFlag(questionId: number, kind: FlagKind): Promise<void> {
  await (await backend()).deleteFlag(questionId, kind);
}

/** The question's flags, at most one of each kind. */
export async function getFlags(questionId: number): Promise<Flag[]> {
  return (await backend()).getFlags(questionId);
}

/** Every flag, newest first (the Flagged page, D2). */
export async function listFlags(): Promise<Flag[]> {
  return (await (await backend()).listFlags()).sort((a, b) => b.at - a.at);
}

// Export, import and clear (D8)

/** Every answer, exam and flag on this device as the version 1 export file; question state is never exported. Save it under `exportFileName(exportedAt)`. */
export async function exportProgress(exportedAt: number = Date.now()): Promise<ExportFile> {
  return toExportFile(await (await backend()).readAll(), exportedAt);
}

/** What an import did: what it added, or why the file was refused (nothing changed). */
export type ImportResult = { ok: true; added: ImportCounts } | { ok: false; reason: ExportRefusal };

/**
 * Imports an export from the file's text (`await file.text()`). Anything that
 * is not a well-formed version 1 Caçador export is refused and nothing
 * changes. Otherwise, in one transaction, it merges answers by (questionId,
 * at), exams by id and flags by (questionId, kind) under D8's rules, leaves at
 * most one exam unfinished (the most recently started; the others settled at
 * their deadlines as D3 settles them), rebuilds every question state from the
 * merged log, and reports the answers inserted, the exams inserted or replaced
 * by the file's copy and the flags inserted or replaced by a newer one.
 */
export async function importProgress(text: string): Promise<ImportResult> {
  const read = readExportFile(text);
  if (!read.ok) return read;
  return { ok: true, added: await (await backend()).importFile(read.file) };
}

/** Clear progress (D8): empties every store and forgets the no-repeat window (sessionStorage `cacador.recent`); the UI language stays. */
export async function clearProgress(): Promise<void> {
  await (await backend()).clear();
  try {
    globalThis.sessionStorage?.removeItem(RECENT_KEY);
  } catch {
    // Web Storage blocked: there is no window to forget.
  }
}
