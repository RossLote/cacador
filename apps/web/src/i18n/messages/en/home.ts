import { common } from './common';

const minutesLeft = (minutes: number) => (minutes === 1 ? '1 minute left' : `${minutes} minutes left`);

/**
 * Home (DESIGN.md § 6.3, epic cac-8cn D7): readiness against the pass line, the
 * unseen count, the exam in progress, the Quick 10, Words, Practice and Exam
 * cards and the weakest topics. The Practice and Exam titles are common.nav's
 * words; the row words are Progress's, duplicated here rather than shared (D18).
 */
export const home = {
  /** The page heading: the app name. */
  title: common.appName,
  readiness: 'Readiness',
  loading: 'Loading progress',
  /** Storage could not be read. */
  loadFailed: 'Could not read your progress on this device. Reload the page to try again.',
  percent: (percent: number) => `${percent} %`,
  /** Under the readiness bar, whose mark sits at this percentage. */
  passLine: (percent: number) => `Pass line ${percent} %`,
  unseen: (count: number) => `${count} unseen`,
  examInProgress: 'Exam in progress',
  /** The exam card's line: the whole minutes left, then how many of its questions hold an answer. */
  examStatus: (minutes: number, answered: number, size: number) => `${minutesLeft(minutes)} · ${answered} of ${size} answered`,
  /** The title of the round card: the round's size (DESIGN.md § 6.4). */
  roundTitle: (size: number) => `Quick ${size}`,
  /** The line on the round card: the same draw as Practice, with an end. */
  roundLine: 'Weak ones first, then your score',
  /** The title of the words drill's card (DESIGN.md § 6.11). */
  wordsTitle: 'Words',
  /** The line on the words card: the round's size, and the way the drill asks. */
  wordsLine: (size: number) => `${size} terms from the bank · Portuguese to English`,
  /** The line on the Practice card. */
  practiceLine: 'Weak ones first',
  /** The line on the Exam card: the exam's size and its minutes. */
  examLine: (size: number, minutes: number) => `${size} questions · ${minutes} min`,
  weakestTopics: 'Weakest topics',
  /** The link to Progress beside the Weakest topics caption. */
  allTopics: 'All topics',
  seen: (seen: number, total: number) => `Seen ${seen} of ${total}`,
  /** A weakest topic's accessible name: its name, then its accuracy and coverage, as Progress names its rows. */
  topicRow: (name: string, percent: number, seen: number, total: number) =>
    `${name}: ${percent} %, seen ${seen} of ${total}`,
};
