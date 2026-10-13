/**
 * Progress (DESIGN.md § 6.6, D11). The readiness words are Home's, duplicated
 * here rather than shared (D18).
 */
const answers = (total: number) => (total === 1 ? '1 answer' : `${total} answers`);
const dayCounts = (total: number, correct: number) => `${answers(total)}, ${correct} right`;
const questions = (total: number) => (total === 1 ? '1 question' : `${total} questions`);

export const progress = {
  title: 'Progress',
  loading: 'Loading progress',
  /** Storage could not be read. */
  loadFailed: 'Could not read your progress on this device. Reload the page to try again.',
  readiness: 'Readiness',
  percent: (percent: number) => `${percent} %`,
  unseen: (count: number) => `${count} unseen`,
  passLine: (percent: number) => `Pass line ${percent} %`,

  days: 'Last 30 days',
  /** The bar chart's list, for screen readers. */
  daysChart: 'Answers per day, oldest first',
  /** One bar's accessible name: the day (already formatted, "13 Oct") and its counts. */
  dayBar: (date: string, total: number, correct: number) => `${date}: ${dayCounts(total, correct)}`,
  /** The last bar's accessible name. */
  todayBar: (date: string, total: number, correct: number) => `Today, ${date}: ${dayCounts(total, correct)}`,
  today: 'Today',
  /** The line under the chart. */
  todayCounts: (total: number, correct: number) => `Today: ${dayCounts(total, correct)}`,

  groups: 'Accuracy',
  groupsHint: 'Weakest first. Tap one to practise it.',
  topics: 'Topics',
  sections: 'Sections',
  patterns: 'Patterns',
  seen: (seen: number, total: number) => `Seen ${seen} of ${total}`,
  questions,
  notStarted: 'Not started',
  /** A row's accessible name: the group's name, then its accuracy and coverage. */
  startedRow: (name: string, percent: number, seen: number, total: number) =>
    `${name}: ${percent} %, seen ${seen} of ${total}`,
  notStartedRow: (name: string, total: number) => `${name}: not started, ${questions(total)}`,

  exams: 'Past exams',
  noExams: 'No finished exams yet.',
  score: (score: number, size: number) => `${score} / ${size}`,
  passed: 'Passed',
  notPassed: 'Not passed',
  /** A past exam's accessible name: its date (already formatted), score and outcome. */
  examRow: (date: string, score: number, size: number, outcome: string) => `${date}: ${score} of ${size}, ${outcome}`,

  flagged: (count: number) => `Flagged (${count})`,
};
