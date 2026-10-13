/**
 * The export file (phase 4 D8, DESIGN.md § 7): building it, naming it, and
 * reading one back. Reading validates the whole shape and refuses the file on
 * the first record that is not well formed, so an import never half-applies.
 */
import { questionById } from '@cacador/data';
import { isOneOf } from '@/lib/isOneOf';
import { EXAM_SIZE, examDeadline, isCorrectOption, localDateKey, MINUTE_MS, scoreExam } from '@/model';
import { isWellFormedAnswer, withoutLogId } from './state';
import { FLAG_KINDS, OPTION_KEYS, type Answer, type Exam, type ExportFile, type Flag, type OptionKey } from './types';

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

/** How far ahead of the importing device's clock a time in the file may be: two devices' clocks never agree exactly. */
export const CLOCK_SKEW_MS = 5 * MINUTE_MS;

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

/** A question in the bank (1 to 506): the only ids the app ever records. */
const isQuestionId = (v: unknown): v is number => typeof v === 'number' && questionById(v) !== undefined;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isString = (v: unknown): v is string => typeof v === 'string';
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isOption = isOneOf(OPTION_KEYS);
const isMode = (v: unknown): v is Answer['mode'] => v === 'practice' || v === 'exam';
const isKind = isOneOf(FLAG_KINDS);

/** A time that has happened by `now`, give or take `CLOCK_SKEW_MS`: a later one would outrank every real record. */
const timeBy =
  (now: number) =>
  (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v <= now + CLOCK_SKEW_MS;

type IsTime = ReturnType<typeof timeBy>;

function list<T>(value: unknown, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Malformed();
  return value.map(read);
}

/**
 * An answer as D15 shapes it (`isWellFormedAnswer`). `correct` is worked out
 * again from the bank's key, so a file from before a key correction, or one
 * edited by hand, cannot count a wrong option right.
 */
function readAnswer(value: unknown, isTime: IsTime): Answer {
  const f = fields(value);
  if (f.id !== undefined) check(f.id, isCount);
  const answer: Answer = {
    questionId: check(f.questionId, isQuestionId),
    at: check(f.at, isTime),
    correct: check(f.correct, isBoolean),
    mode: check(f.mode, isMode),
  };
  if (f.chosen !== undefined) answer.chosen = check(f.chosen, isOption);
  if (f.examId !== undefined) answer.examId = check(f.examId, isId);
  if (!isWellFormedAnswer(answer)) throw new Malformed();
  answer.correct = isCorrectOption(answer.questionId, answer.chosen);
  return answer;
}

/**
 * An exam as D15 shapes it: 20 distinct questions from the bank, answers only
 * to those, and finishedAt and score both set (finished, within its 30
 * minutes) or both absent (unfinished). The score is worked out again from the
 * answers, as `correct` is.
 */
function readExam(value: unknown, isTime: IsTime): Exam {
  const f = fields(value);
  const questionIds = list(f.questionIds, (id) => check(id, isQuestionId));
  if (questionIds.length !== EXAM_SIZE || new Set(questionIds).size !== EXAM_SIZE) throw new Malformed();
  const answers: Record<number, OptionKey> = {};
  for (const [key, option] of Object.entries(fields(f.answers))) {
    const questionId = Number(key);
    if (!questionIds.includes(questionId)) throw new Malformed();
    answers[questionId] = check(option, isOption);
  }
  const exam: Exam = { id: check(f.id, isId), startedAt: check(f.startedAt, isTime), questionIds, answers };
  if ((f.finishedAt === undefined) !== (f.score === undefined)) throw new Malformed();
  if (f.finishedAt !== undefined) {
    const finishedAt = check(f.finishedAt, isTime);
    if (finishedAt < exam.startedAt || finishedAt > examDeadline(exam)) throw new Malformed();
    check(f.score, isCount);
    exam.finishedAt = finishedAt;
    exam.score = scoreExam(exam);
  }
  return exam;
}

function readFlag(value: unknown, isTime: IsTime): Flag {
  const f = fields(value);
  return {
    questionId: check(f.questionId, isQuestionId),
    kind: check(f.kind, isKind),
    note: check(f.note, isString),
    at: check(f.at, isTime),
  };
}

/**
 * Checks parsed JSON is a version 1 Caçador export (D8) holding only records
 * the app itself writes, and returns it with every record rebuilt from its
 * known fields, so nothing unexpected is stored. Every time must have happened
 * by `now` (the import's moment, give or take `CLOCK_SKEW_MS`), and every exam
 * answer must belong to a finished exam in the same file, as every exam answer
 * in an export does. An answer's `correct` and an exam's `score` are worked out
 * again from the bank's key rather than taken as stated. Anything else is
 * refused with the reason.
 */
export function validateExportFile(data: unknown, now: number): ReadExportResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'not-cacador' };
  const f = data as Fields;
  const isTime = timeBy(now);
  try {
    if (f.app !== 'cacador') return { ok: false, reason: 'not-cacador' };
    if (f.version !== 1) return { ok: false, reason: 'unsupported-version' };
    const file: ExportFile = {
      app: 'cacador',
      version: 1,
      exportedAt: check(f.exportedAt, isTime),
      answers: list(f.answers, (answer) => readAnswer(answer, isTime)),
      exams: list(f.exams, (exam) => readExam(exam, isTime)),
      flags: list(f.flags, (flag) => readFlag(flag, isTime)),
    };
    const finished = new Set(file.exams.filter((exam) => exam.finishedAt !== undefined).map((exam) => exam.id));
    if (file.answers.some((answer) => answer.examId !== undefined && !finished.has(answer.examId))) throw new Malformed();
    return { ok: true, file };
  } catch (error) {
    if (!(error instanceof Malformed)) throw error;
    return { ok: false, reason: 'malformed' };
  }
}

/** Reads an export from a file's text (`File.text()`), refusing text that is not JSON or not a version 1 Caçador export. */
export function readExportFile(text: string, now: number): ReadExportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  return validateExportFile(data, now);
}
