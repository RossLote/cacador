/**
 * The records the app keeps on the device (phase 4 D15, DESIGN.md § 7) and the
 * export file (D8), with the two lists of allowed values. The storage module
 * (D16) reads and writes them.
 * Never widened inside a bead; a change is a CHANGE PROTOCOL item.
 */
import type { OptionKey } from '@cacador/data';

export type { OptionKey };

/** A question's options, in the order the card shows them. */
export const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C'];

/** How an answer was given. */
export type AnswerMode = 'practice' | 'exam';

/** One answer in the append-only log (store `answers`, autoIncrement key). */
export interface Answer {
  /** Assigned by IndexedDB on insert; absent on a record not yet written. */
  id?: number;
  questionId: number;
  /** When it was answered, ms since the epoch. */
  at: number;
  /** The option picked; absent for an exam question left unanswered (D3). */
  chosen?: OptionKey;
  correct: boolean;
  mode: AnswerMode;
  /** The exam it was given in, for mode "exam". */
  examId?: string;
}

/** Per-question state, derived from the answers log and rebuilt from it (store `questionState`, key questionId). */
export interface QuestionState {
  questionId: number;
  attempts: number;
  /** How many of the attempts were right. */
  correct: number;
  /** Right answers in a row up to the last one; 0 after a wrong answer. */
  streak: number;
  /** The last three answers, right or wrong, newest last. */
  recent: boolean[];
  /** The last answer's time, ms since the epoch. */
  lastSeenAt: number;
}

/** A mock exam, unfinished until submitted (store `exams`, key id). */
export interface Exam {
  id: string;
  /** ms since the epoch; the 30-minute deadline counts from here. */
  startedAt: number;
  /** The 20 questions drawn, in order. */
  questionIds: number[];
  /** The option chosen per question id; a question not answered has no entry. */
  answers: Record<number, OptionKey>;
  finishedAt?: number;
  /** Right answers out of 20, set when finished. */
  score?: number;
}

/** What a flag can say is off (D2): the English, or the hint; in the order the flags row shows them. */
export const FLAG_KINDS = ['translation', 'hint'] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/** A flag on a question, one per question and kind (store `flags`, key [questionId, kind]). */
export interface Flag {
  questionId: number;
  kind: FlagKind;
  note: string;
  /** When it was set or last saved, ms since the epoch. */
  at: number;
}

/** The export file, cacador-progress-<YYYY-MM-DD>.json (D8). Question state is never exported. */
export interface ExportFile {
  app: 'cacador';
  version: 1;
  /** ms since the epoch. */
  exportedAt: number;
  answers: Answer[];
  exams: Exam[];
  flags: Flag[];
}
