import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateMap } from '@/model';
import { RECENT_KEY } from '@/storage';

const fresh: StateMap = new Map();

/** The module anew, so the window it keeps in memory starts empty. */
async function loadRecent() {
  vi.resetModules();
  return import('./recent');
}

describe('drawPracticeQuestion', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('keeps the window in sessionStorage', async () => {
    const { drawPracticeQuestion } = await loadRecent();
    expect([1, 2, 3].map(() => drawPracticeQuestion([1, 2, 3, 4, 5], fresh))).toEqual([1, 2, 3]);
    expect(JSON.parse(sessionStorage.getItem(RECENT_KEY)!)).toEqual([1, 2, 3]);
  });

  it('keeps the window in memory for the page when sessionStorage is blocked (cac-eil.32)', async () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const { drawPracticeQuestion } = await loadRecent();
    // A pool of five has a window of two: without it a source of 0 would draw 1 every time.
    const ids = [1, 2, 3, 4, 5].map(() => drawPracticeQuestion([1, 2, 3, 4, 5], fresh));
    expect(ids).toEqual([1, 2, 3, 1, 2]);
  });
});
