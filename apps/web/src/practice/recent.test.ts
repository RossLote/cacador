import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StateMap } from '@/model';
import { RECENT_KEY } from '@/storage';

const fresh: StateMap = new Map();

/** The module anew, with the storage module it draws through, so the window kept in memory starts empty. */
async function loadRecent() {
  vi.resetModules();
  const [recent, storage] = await Promise.all([import('./recent'), import('@/storage')]);
  return { ...recent, storage };
}

function blockWebStorage(): void {
  const blocked = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
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
    blockWebStorage();
    const { drawPracticeQuestion } = await loadRecent();
    // A pool of five has a window of two: without it a source of 0 would draw 1 every time.
    const ids = [1, 2, 3, 4, 5].map(() => drawPracticeQuestion([1, 2, 3, 4, 5], fresh));
    expect(ids).toEqual([1, 2, 3, 1, 2]);
  });

  it('forgets the window kept in memory on Clear progress (cac-eil.61)', async () => {
    blockWebStorage();
    const { drawPracticeQuestion, storage } = await loadRecent();
    expect([1, 2].map(() => drawPracticeQuestion([1, 2, 3, 4, 5], fresh))).toEqual([1, 2]);
    expect(storage.readRecentWindow()).toEqual([1, 2]);

    await storage.clearProgress();
    expect(storage.readRecentWindow()).toEqual([]);
    // With the window empty, a source of 0 draws the first question again.
    expect(drawPracticeQuestion([1, 2, 3, 4, 5], fresh)).toBe(1);
    await storage.closeStorage();
  });
});
