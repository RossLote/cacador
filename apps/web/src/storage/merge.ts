/**
 * The import merge (phase 4 D8, DESIGN.md § 7), pure: given what the device
 * holds and a validated export, what the import writes and what it reports.
 * Both backends read the device's records, call `planImport` and apply the
 * plan in one transaction, so the rules live only here.
 */
import { examDeadline } from '@/model';
import type { ProgressRecords } from './exportFile';
import { finishExamRecords } from './finish';
import { rebuildStates } from './state';
import type { Answer, Exam, ExportFile, Flag, QuestionState } from './types';

/** What an import added: answers inserted, exams inserted or replaced by the file's copy, flags inserted or replaced by a newer one. */
export interface ImportCounts {
  answers: number;
  exams: number;
  flags: number;
}

/** The writes an import makes, in one transaction. */
interface ImportPlan {
  /** Log ids of the device's answers to an exam whose copy from the file replaced the device's own. */
  removeAnswerIds: number[];
  /** New log entries, without ids: the file's answers this device lacks, then the answers of exams the merge settled. */
  addAnswers: Answer[];
  /** Exams to write: the file's winning copies and the exams the merge settled. */
  putExams: Exam[];
  /** Flags to write: the file's new or newer ones. */
  putFlags: Flag[];
  /** Every question's state rebuilt from the merged log; the store is replaced by exactly these. */
  states: QuestionState[];
  added: ImportCounts;
}

const answerCount = (exam: Exam): number => Object.keys(exam.answers).length;

/**
 * Whether the file's copy of an exam replaces the one kept so far (D8): a
 * finished copy beats an unfinished one, the earlier finishedAt wins between
 * two finished, more answers between two unfinished, and the copy already kept
 * (the device's own) on a tie.
 */
export function replacesExam(incoming: Exam, kept: Exam): boolean {
  if (incoming.finishedAt !== undefined && kept.finishedAt !== undefined) return incoming.finishedAt < kept.finishedAt;
  if (incoming.finishedAt !== undefined || kept.finishedAt !== undefined) return incoming.finishedAt !== undefined;
  return answerCount(incoming) > answerCount(kept);
}

/** Whether the file's flag replaces the one kept for its question and kind: only a newer one does (D8). */
export function replacesFlag(incoming: Flag, kept: Flag): boolean {
  return incoming.at > kept.at;
}

/** `added` numbered after every id in `log`, as the log's autoIncrement key will number them, so a rebuild orders them as the stored log will. */
function withNextIds(log: readonly Answer[], added: readonly Answer[]): Answer[] {
  const last = log.reduce((max, answer) => Math.max(max, answer.id ?? 0), 0);
  return added.map((answer, i) => ({ ...answer, id: last + 1 + i }));
}

const answerKey = (a: Pick<Answer, 'questionId' | 'at'>): string => `${a.questionId}@${a.at}`;
/** A flag's key as a string, one per question and kind. */
export const flagKey = (f: Pick<Flag, 'questionId' | 'kind'>): string => `${f.questionId}:${f.kind}`;

/**
 * Merges `file` into the device's `device` records (D8):
 *
 * - exams by id under `replacesExam`. The log's answers to an exam are those
 *   of the copy kept: when the file's copy wins over one the device holds, the
 *   device's answers to that exam go and the file's come in; when the device's
 *   copy stays, the file's answers to it are left out. So a finished exam is
 *   never logged twice, and an exam that arrives finished is never settled
 *   again: its answers arrive in the file's log.
 * - answers by (questionId, at): a file answer is added unless the merged log
 *   already has one for that question at that moment.
 * - flags by (questionId, kind) under `replacesFlag`.
 *
 * When more than one exam is then unfinished, the most recently started stays
 * so and each other is settled as .3's settling does (D3): finished as it
 * stands at its deadline, one answer per question logged at the deadline.
 * Every question state is rebuilt from the merged log.
 */
export function planImport(device: ProgressRecords, file: ExportFile): ImportPlan {
  // Exams: the device's, then the file's folded in; `fromFile` marks the ids whose kept copy came from the file.
  const exams = new Map(device.exams.map((exam) => [exam.id, exam]));
  const onDevice = new Set(exams.keys());
  const fromFile = new Set<string>();
  for (const exam of file.exams) {
    const kept = exams.get(exam.id);
    if (kept === undefined || replacesExam(exam, kept)) {
      exams.set(exam.id, exam);
      fromFile.add(exam.id);
    }
  }
  const replacedOnDevice = (examId: string | undefined): boolean => examId !== undefined && onDevice.has(examId) && fromFile.has(examId);
  const keptFromDevice = (examId: string | undefined): boolean => examId !== undefined && onDevice.has(examId) && !fromFile.has(examId);

  // Answers.
  const removeAnswerIds: number[] = [];
  const log: Answer[] = [];
  for (const answer of device.answers) {
    if (replacedOnDevice(answer.examId) && answer.id !== undefined) removeAnswerIds.push(answer.id);
    else log.push(answer);
  }
  const seen = new Set(log.map(answerKey));
  const addAnswers: Answer[] = [];
  for (const answer of file.answers) {
    const key = answerKey(answer);
    if (keptFromDevice(answer.examId) || seen.has(key)) continue;
    seen.add(key);
    addAnswers.push(answer);
  }

  // At most one unfinished exam: the most recently started; the others settled at their deadlines.
  const settled = new Set<string>();
  const unfinished = [...exams.values()].filter((exam) => exam.finishedAt === undefined).sort((a, b) => b.startedAt - a.startedAt);
  for (const exam of unfinished.slice(1)) {
    const finished = finishExamRecords(exam, examDeadline(exam));
    exams.set(exam.id, finished.exam);
    addAnswers.push(...finished.answers);
    settled.add(exam.id);
  }

  // Flags.
  const flags = new Map(device.flags.map((flag) => [flagKey(flag), flag]));
  const putFlags = new Map<string, Flag>();
  for (const flag of file.flags) {
    const key = flagKey(flag);
    const kept = flags.get(key);
    if (kept !== undefined && !replacesFlag(flag, kept)) continue;
    flags.set(key, flag);
    putFlags.set(key, flag);
  }

  return {
    removeAnswerIds,
    addAnswers,
    putExams: [...exams.values()].filter((exam) => fromFile.has(exam.id) || settled.has(exam.id)),
    putFlags: [...putFlags.values()],
    states: rebuildStates([...log, ...withNextIds(log, addAnswers)]),
    added: { answers: addAnswers.length, exams: fromFile.size, flags: putFlags.size },
  };
}
