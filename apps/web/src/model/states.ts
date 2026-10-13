import type { QuestionState } from '@/storage/types';

/** Question states by question id; a question with no entry is unseen. */
export type StateMap = ReadonlyMap<number, QuestionState>;

/** Index a list of question states (as the storage module returns them) by question id. */
export function indexStates(states: Iterable<QuestionState>): Map<number, QuestionState> {
  const byId = new Map<number, QuestionState>();
  for (const state of states) byId.set(state.questionId, state);
  return byId;
}

/** A question counts as seen once it has been answered at least once. */
export function isSeen(state: QuestionState | undefined): state is QuestionState {
  return state !== undefined && state.attempts > 0 && state.recent.length > 0;
}

/** The share right in a seen question's recent list (its last three answers), or undefined when unseen (D5). */
export function recentShare(state: QuestionState | undefined): number | undefined {
  if (!isSeen(state)) return undefined;
  return state.recent.filter(Boolean).length / state.recent.length;
}
