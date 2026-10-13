import { useEffect, useState } from 'react';
import { examTimeLeft } from '@/model';
import type { Exam } from '@/storage';

const SECOND_MS = 1000;

/** Time left as mm:ss, whole seconds rounded up, so 30:00 shows for the first second and 00:00 only at the deadline. */
export function formatClock(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / SECOND_MS);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * The exam's time left, ms, recomputed from its start time on every tick
 * (D3), so it is right after a reload and keeps running while the app is
 * closed. Wakes when the shown second changes, and calls `onExpire` once none
 * is left.
 */
export function useExamClock(exam: Pick<Exam, 'startedAt'>, onExpire: () => void): number {
  const [now, setNow] = useState(Date.now);
  const left = examTimeLeft(exam, now);
  useEffect(() => {
    if (left <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), left % SECOND_MS || SECOND_MS);
    return () => clearTimeout(timer);
  }, [left, onExpire]);
  return left;
}
