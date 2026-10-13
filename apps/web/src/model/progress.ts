import type { Answer } from '@/storage/types';
import { localDateKey } from './dates';
import { bankPool } from './pools';
import { isSeen, recentShare, type StateMap } from './states';

/** What an unseen question counts toward readiness: chance on three options (D5). */
export const UNSEEN_SHARE = 1 / 3;

/** The readiness line the percentage is shown against (D5, D11). */
export const READINESS_TARGET_PERCENT = 75;

export interface Readiness {
  /** The unrounded mean over every question, 0 to 1. */
  fraction: number;
  /** The fraction as a whole percentage, rounded. */
  percent: number;
  /** Questions never answered. */
  unseen: number;
  /** Questions counted: the whole bank. */
  total: number;
}

/**
 * Readiness over the whole bank (D5): each seen question its recent share,
 * each unseen one a third, the mean over all 506.
 */
export function readiness(states: StateMap): Readiness {
  let seenSum = 0;
  let unseen = 0;
  for (const id of bankPool) {
    const share = recentShare(states.get(id));
    if (share === undefined) unseen++;
    else seenSum += share;
  }
  const total = bankPool.length;
  const fraction = (seenSum + unseen * UNSEEN_SHARE) / total;
  return { fraction, percent: Math.round(fraction * 100), unseen, total };
}

export interface GroupAccuracy {
  /** The mean recent share over the group's seen questions, 0 to 1; undefined when none is seen (not started). */
  accuracy: number | undefined;
  /** The accuracy as a whole percentage, rounded; undefined when not started. */
  percent: number | undefined;
  seen: number;
  total: number;
}

/** The accuracy of a group of questions (a topic, section or pattern pool), D11. */
export function groupAccuracy(ids: readonly number[], states: StateMap): GroupAccuracy {
  let sum = 0;
  let seen = 0;
  for (const id of ids) {
    const state = states.get(id);
    if (!isSeen(state)) continue;
    sum += recentShare(state) ?? 0;
    seen++;
  }
  const accuracy = seen === 0 ? undefined : sum / seen;
  return {
    accuracy,
    percent: accuracy === undefined ? undefined : Math.round(accuracy * 100),
    seen,
    total: ids.length,
  };
}

/** How many days the Progress chart covers (D11). */
export const ACCURACY_DAYS = 30;

export interface DayAccuracy {
  /** The calendar day in the device's time zone, YYYY-MM-DD. */
  date: string;
  /** Local midnight at the start of the day, ms since the epoch. */
  start: number;
  correct: number;
  total: number;
}

/** Local midnight at the start of the day `offset` days before `now`'s, ms since the epoch. */
function dayStart(now: number, offset: number): number {
  const today = new Date(now);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).getTime();
}

/** Local midnight at the start of the chart's oldest day, ms since the epoch: the answers log is read from there (D11). */
export function accuracyWindowStart(now: number): number {
  return dayStart(now, ACCURACY_DAYS - 1);
}

/**
 * Right and total answers per calendar day for the ACCURACY_DAYS days ending
 * today, in the device's time zone, oldest first (the last entry is today), D11.
 */
export function accuracyByDay(answers: readonly Answer[], now: number): DayAccuracy[] {
  const result: DayAccuracy[] = [];
  const byDate = new Map<string, DayAccuracy>();
  for (let offset = ACCURACY_DAYS - 1; offset >= 0; offset--) {
    const start = dayStart(now, offset);
    const entry: DayAccuracy = { date: localDateKey(start), start, correct: 0, total: 0 };
    result.push(entry);
    byDate.set(entry.date, entry);
  }
  for (const answer of answers) {
    const entry = byDate.get(localDateKey(answer.at));
    if (!entry) continue;
    entry.total++;
    if (answer.correct) entry.correct++;
  }
  return result;
}
