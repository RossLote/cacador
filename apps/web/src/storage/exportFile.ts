/**
 * The export file (phase 4 D8, DESIGN.md § 7): building it, naming it, and
 * reading one back. Reading validates the whole shape and refuses the file on
 * the first record that is not well formed, so an import never half-applies.
 */
import { localDateKey } from '@/model';
import { withoutLogId } from './state';
import { FLAG_KINDS, OPTION_KEYS, type Answer, type Exam, type ExportFile, type Flag, type FlagKind, type OptionKey } from './types';

/** The records an export holds: every store but questionState. */
export interface ProgressRecords {
  answers: Answer[];
  exams: Exam[];
  flags: Flag[];
}

/** Why a file was refused: not JSON, not a Caçador export, a version other than 1, or a record not well formed. */
export type ExportRefusal = 'not-json' | 'not-cacador' | 'unsupported-version' | 'malformed';

type ReadExportResult = { ok: true; file: ExportFile } | { ok: false; reason: ExportRefusal };

/** The export's file name, cacador-progress-<YYYY-MM-DD>.json, in the device's date at `now` (D8). */
export function exportFileName(now: number = Date.now()): string {
  return `cacador-progress-${localDateKey(now)}.json`;
}

/** The export of `records` made at `exportedAt`; answers lose their log ids, which only mean something on this device. */
export function toExportFile(records: ProgressRecords, exportedAt: number): ExportFile {
  return {
    app: 'cacador',
    version: 1,
    exportedAt,
    answers: records.answers.map(withoutLogId),
    exams: records.exams,
    flags: records.flags,
  };
}

/** Thrown inside validation and caught at its edge: one bad record refuses the whole file. */
class Malformed extends Error {}

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Malformed();
  return value as Fields;
}

function check<T>(value: unknown, ok: (v: unknown) => v is T): T {
  if (!ok(value)) throw new Malformed();
  return value;
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isQuestionId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isString = (v: unknown): v is string => typeof v === 'string';
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isOption = (v: unknown): v is OptionKey => OPTION_KEYS.some((key) => key === v);
const isMode = (v: unknown): v is Answer['mode'] => v === 'practice' || v === 'exam';
const isKind = (v: unknown): v is FlagKind => FLAG_KINDS.some((kind) => kind === v);

function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Malformed();
  return value.map(read);
}

/** An answer as D15 shapes it; `chosen` may be absent only for an exam question left unanswered, which is wrong. */
function readAnswer(value: unknown): Answer {
  const f = fields(value);
  if (f.id !== undefined) check(f.id, isCount);
  const answer: Answer = {
    questionId: check(f.questionId, isQuestionId),
    at: check(f.at, isTime),
    correct: check(f.correct, isBoolean),
    mode: check(f.mode, isMode),
  };
  if (f.chosen !== undefined) answer.chosen = check(f.chosen, isOption);
  else if (answer.mode !== 'exam' || answer.correct) throw new Malformed();
  if (f.examId !== undefined) answer.examId = check(f.examId, isId);
  return answer;
}

/** An exam as D15 shapes it; finishedAt and score are both set (finished) or both absent (unfinished). */
function readExam(value: unknown): Exam {
  const f = fields(value);
  const answers: Record<number, OptionKey> = {};
  for (const [key, option] of Object.entries(fields(f.answers))) {
    answers[check(Number(key), isQuestionId)] = check(option, isOption);
  }
  const exam: Exam = {
    id: check(f.id, isId),
    startedAt: check(f.startedAt, isTime),
    questionIds: list(f.questionIds, (id) => check(id, isQuestionId)),
    answers,
  };
  if ((f.finishedAt === undefined) !== (f.score === undefined)) throw new Malformed();
  if (f.finishedAt !== undefined) {
    exam.finishedAt = check(f.finishedAt, isTime);
    exam.score = check(f.score, isCount);
  }
  return exam;
}

function readFlag(value: unknown): Flag {
  const f = fields(value);
  return {
    questionId: check(f.questionId, isQuestionId),
    kind: check(f.kind, isKind),
    note: check(f.note, isString),
    at: check(f.at, isTime),
  };
}

/**
 * Checks parsed JSON is a version 1 Caçador export (D8) and returns it with
 * every record rebuilt from its known fields only, so nothing unexpected is
 * stored. Anything else is refused with the reason.
 */
export function validateExportFile(data: unknown): ReadExportResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'not-cacador' };
  const f = data as Fields;
  try {
    if (f.app !== 'cacador') return { ok: false, reason: 'not-cacador' };
    if (f.version !== 1) return { ok: false, reason: 'unsupported-version' };
    return {
      ok: true,
      file: {
        app: 'cacador',
        version: 1,
        exportedAt: check(f.exportedAt, isTime),
        answers: list(f.answers, readAnswer),
        exams: list(f.exams, readExam),
        flags: list(f.flags, readFlag),
      },
    };
  } catch (error) {
    if (!(error instanceof Malformed)) throw error;
    return { ok: false, reason: 'malformed' };
  }
}

/** Reads an export from a file's text (`File.text()`), refusing text that is not JSON or not a version 1 Caçador export. */
export function readExportFile(text: string): ReadExportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  return validateExportFile(data);
}
