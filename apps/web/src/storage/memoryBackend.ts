import type { StorageBackend } from './backend';
import { finishExamRecords, runningExam, withExamAnswer } from './finish';
import { flagKey, planImport } from './merge';
import { compareAnswers, nextState } from './state';
import type { Answer, Exam, Flag, QuestionState } from './types';

/**
 * The same operations as the IndexedDB backend, kept in memory for as long as
 * the page is open: used when IndexedDB cannot be opened (D16), so the app
 * still works and nothing is saved. Records are copied in and out, as
 * IndexedDB does, so a caller's later edits never reach the stores.
 */
export function createMemoryBackend(): StorageBackend {
  let answers: Answer[] = [];
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
    listStates: async () => [...states.values()].map((s) => copy(s)),

    startExam: async (exam) => {
      const running = runningExam([...exams.values()], exam.startedAt);
      if (running !== undefined) return copy(running);
      if (exams.has(exam.id)) throw new Error(`Exam ${exam.id} already exists`);
      exams.set(exam.id, copy(exam));
      return copy(exam);
    },
    getExam: async (id) => {
      const exam = exams.get(id);
      return exam && copy(exam);
    },
    listExams: async () => [...exams.values()].map((e) => copy(e)),
    setExamAnswer: async (id, questionId, option, at) => {
      const answered = withExamAnswer(exams.get(id), questionId, option, at);
      if (answered === undefined) return false;
      exams.set(id, answered);
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
      flags.set(flagKey(flag), copy(flag));
    },
    deleteFlag: async (questionId, kind) => {
      flags.delete(flagKey({ questionId, kind }));
    },
    getFlags: async (questionId) => [...flags.values()].filter((f) => f.questionId === questionId).map((f) => copy(f)),
    listFlags: async () => [...flags.values()].map((f) => copy(f)),

    readAll: async () => ({
      answers: answers.toSorted(compareAnswers).map((a) => copy(a)),
      exams: [...exams.values()].map((e) => copy(e)),
      flags: [...flags.values()].map((f) => copy(f)),
    }),
    importFile: async (file, now) => {
      const plan = planImport({ answers, exams: [...exams.values()], flags: [...flags.values()] }, copy(file), now);
      const removed = new Set(plan.removeAnswerIds);
      answers = answers.filter((a) => a.id === undefined || !removed.has(a.id));
      for (const answer of plan.addAnswers) answers.push({ ...answer, id: nextId++ });
      for (const exam of plan.putExams) exams.set(exam.id, exam);
      for (const flag of plan.putFlags) flags.set(flagKey(flag), flag);
      states.clear();
      for (const state of plan.states) states.set(state.questionId, state);
      return plan.added;
    },
    clear: async () => {
      answers = [];
      states.clear();
      exams.clear();
      flags.clear();
    },

    close: () => {},
  };
}
