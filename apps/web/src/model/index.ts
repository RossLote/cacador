/**
 * The study model (phase 4 D3, D5, D11): pure functions for the numbers and
 * draws every screen and the storage module use. No DOM, storage or strings.
 */
export { seededRandom, type RandomSource } from './random';
export { indexStates, isSeen, recentShare, type StateMap } from './states';
export { addToRecent, drawQuestion, drawWeight, noRepeatWindow, RECENT_LIMIT } from './draw';
export {
  ACCURACY_DAYS,
  accuracyByDay,
  groupAccuracy,
  localDateKey,
  READINESS_TARGET_PERCENT,
  readiness,
  UNSEEN_SHARE,
  type DayAccuracy,
  type GroupAccuracy,
  type Readiness,
} from './progress';
export { bankPool, patternPool, sectionPool, topicPool } from './pools';
export {
  drawExam,
  EXAM_DURATION_MS,
  EXAM_PASS_MARK,
  EXAM_SIZE,
  examDeadline,
  examPassed,
  examResults,
  examTimeLeft,
  scoreExam,
  type ExamQuestionResult,
} from './exam';
