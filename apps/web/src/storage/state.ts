import type { Answer, QuestionState } from './types';

/** How many answers a question's `recent` list keeps (D15): its last three. */
export const RECENT_SIZE = 3;

/**
 * The state a question is in after one more answer, newer than every answer
 * `state` already counts (D15). A wrong answer, or one with no chosen option,
 * resets the streak; `recent` keeps the last three, newest last. Pure, so a
 * rebuild can fold it over the log in time order.
 */
export function applyAnswer(state: QuestionState | undefined, answer: Pick<Answer, 'questionId' | 'at' | 'correct'>): QuestionState {
  const recent = [...(state?.recent ?? []), answer.correct].slice(-RECENT_SIZE);
  return {
    questionId: answer.questionId,
    attempts: (state?.attempts ?? 0) + 1,
    correct: (state?.correct ?? 0) + (answer.correct ? 1 : 0),
    streak: answer.correct ? (state?.streak ?? 0) + 1 : 0,
    recent,
    lastSeenAt: answer.at,
  };
}

/** Log order: by time, and by insertion (the log's key) between answers given at the same moment. */
export function compareAnswers(a: Answer, b: Answer): number {
  return a.at - b.at || (a.id ?? 0) - (b.id ?? 0);
}

/** A copy of `answer` without its log id, which only means something in this device's log. */
export function withoutLogId(answer: Answer): Answer {
  const copy: Answer = { ...answer };
  delete copy.id;
  return copy;
}

/** One question's state rebuilt from its answers in any order, or undefined when it has none. */
export function deriveState(answers: readonly Answer[]): QuestionState | undefined {
  return [...answers].sort(compareAnswers).reduce<QuestionState | undefined>(applyAnswer, undefined);
}

/** Whether `answer` is at least as new as every answer `state` counts, so `applyAnswer` can count it on top. */
export function isInOrder(state: QuestionState | undefined, answer: Pick<Answer, 'at'>): boolean {
  return state === undefined || answer.at >= state.lastSeenAt;
}

/**
 * The question's state once `answer` (already in the log) is counted: applied
 * on top when it is in order, and otherwise (an exam settled at its deadline
 * after later practice) rebuilt from `log`, the question's answers, which is
 * read only then. Either way the state equals what the log implies (D16).
 */
export function nextState(state: QuestionState | undefined, answer: Answer, log: () => readonly Answer[]): QuestionState {
  if (isInOrder(state, answer)) return applyAnswer(state, answer);
  return deriveState(log()) ?? applyAnswer(undefined, answer);
}

/** Every question's state rebuilt from the whole log (import, D8): one per question that has answers. */
export function rebuildStates(answers: readonly Answer[]): QuestionState[] {
  const byQuestion = new Map<number, Answer[]>();
  for (const answer of answers) {
    const list = byQuestion.get(answer.questionId);
    if (list === undefined) byQuestion.set(answer.questionId, [answer]);
    else list.push(answer);
  }
  return [...byQuestion.values()].flatMap((log) => deriveState(log) ?? []);
}
