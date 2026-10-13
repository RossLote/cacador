import { common } from './common';

/** Home (DESIGN.md § 6.3): readiness against the pass line, the unseen count and the exam in progress. */
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
  minutesLeft: (minutes: number) => (minutes === 1 ? '1 minute left' : `${minutes} minutes left`),
};
