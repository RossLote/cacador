/**
 * The study model (phase 4 D3, D4, D5, D11): pure functions for the numbers and
 * draws every screen and the storage module use. No DOM, storage or strings.
 */
export { seededRandom, shuffled, type RandomSource } from './random';
export { localDateKey } from './dates';
export { indexStates, type StateMap } from './states';
export { addToRecent, drawQuestion, RECENT_LIMIT } from './draw';
export {
  accuracyByDay,
  accuracyWindowStart,
  groupAccuracy,
  READINESS_TARGET_PERCENT,
  readiness,
  type DayAccuracy,
  type GroupAccuracy,
  type Readiness,
} from './progress';
export { bankPool, patternPool } from './pools';
export { parseRoundSize, ROUND_SIZE, roundPath } from './round';
export { findGroup, GROUP_KINDS, groupPath, GROUPS, type BilingualName, type Group, type GroupKind } from './groups';
export {
  drawExam,
  EXAM_DURATION_MS,
  EXAM_PASS_MARK,
  EXAM_SIZE,
  examDeadline,
  examPassed,
  examResults,
  examResultsPath,
  examTimeLeft,
  isCorrectOption,
  isFinished,
  MINUTE_MS,
  scoreExam,
  type FinishedExam,
} from './exam';
export {
  nextWordsOfPass,
  settleWordPass,
  spendWordOfPass,
  WORD_ROUND_SIZE,
  wordOptions,
  type WordPass,
} from './words';
