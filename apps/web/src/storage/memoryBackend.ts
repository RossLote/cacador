import type { StorageBackend } from './backend';
import { finishExamRecords, isRunning } from './finish';
import { compareAnswers, nextState } from './state';
import type { Answer, Exam, Flag, FlagKind, QuestionState } from './types';

const flagKey = (questionId: number, kind: FlagKind): string => `${questionId}:${kind}`;

/**
 * The same operations as the IndexedDB backend, kept in memory for as long as
 * the page is open: used when IndexedDB cannot be opened (D16), so the app
 * still works and nothing is saved. Records are copied in and out, as
 * IndexedDB does, so a caller's later edits never reach the stores.
 */
export function createMemoryBackend(): StorageBackend {
  const answers: Answer[] = [];
  const states = new Map<number, QuestionState>();
  const exams = new Map<string, Exam>();
  const flags = new Map<string, Flag>();
  let nextId = 1;
  const copy = structuredClone;

  const answersFor = (questionId: number): Answer[] =>
    answers.filter((a) => a.questionId === questionId).sort(compareAnswers).map((a) => copy(a));

  // Synchronous, so no other call interleaves: each operation is atomic as a transaction is.
  function appendAnswer(answer: Answer): Answer {
    const stored: Answer = { ...copy(answer), id: nextId++ };
    answers.push(stored);
    states.set(stored.questionId, nextState(states.get(stored.questionId), stored, () => answersFor(stored.questionId)));
    return copy(stored);
  }

  return {
    mode: 'memory',

    addAnswer: async (answer) => appendAnswer(answer),
    listAnswers: async (since) =>
      answers
        .filter((a) => since === undefined || a.at >= since)
        .sort(compareAnswers)
        .map((a) => copy(a)),
    listAnswersFor: async (questionId) => answersFor(questionId),

    getState: async (questionId) => {
      const state = states.get(questionId);
      return state && copy(state);
    },
    listStates: async () => [...states.values()].map((s) => copy(s)),

    addExam: async (exam) => {
      if (exams.has(exam.id)) throw new Error(`Exam ${exam.id} already exists`);
      exams.set(exam.id, copy(exam));
    },
    getExam: async (id) => {
      const exam = exams.get(id);
      return exam && copy(exam);
    },
    listExams: async () => [...exams.values()].map((e) => copy(e)),
    setExamAnswers: async (id, examAnswers, now) => {
      const exam = exams.get(id);
      if (exam === undefined || !isRunning(exam, now)) return false;
      exams.set(id, { ...exam, answers: copy(examAnswers) });
      return true;
    },
    finishExam: async (id, at) => {
      const exam = exams.get(id);
      if (exam === undefined || exam.finishedAt !== undefined) return false;
      const finished = finishExamRecords(exam, at);
      exams.set(id, finished.exam);
      for (const answer of finished.answers) appendAnswer(answer);
      return true;
    },

    putFlag: async (flag) => {
      flags.set(flagKey(flag.questionId, flag.kind), copy(flag));
    },
    deleteFlag: async (questionId, kind) => {
      flags.delete(flagKey(questionId, kind));
    },
    getFlags: async (questionId) => [...flags.values()].filter((f) => f.questionId === questionId).map((f) => copy(f)),
    listFlags: async () => [...flags.values()].map((f) => copy(f)),

    close: () => {},
  };
}
