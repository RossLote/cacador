import { describe, expect, it, vi } from 'vitest';
import { RECENT_KEY } from './keys';

/** The module anew, so the window it keeps in memory starts empty. */
async function loadRecent() {
  vi.resetModules();
  return import('./recent');
}

describe('the no-repeat window', () => {
  it('reads and writes sessionStorage, and Clear removes the key', async () => {
    const { clearRecentWindow, readRecentWindow, writeRecentWindow } = await loadRecent();
    expect(readRecentWindow()).toEqual([]);
    writeRecentWindow([4, 9]);
    expect(sessionStorage.getItem(RECENT_KEY)).toBe('[4,9]');
    expect(readRecentWindow()).toEqual([4, 9]);
    clearRecentWindow();
    expect(sessionStorage.getItem(RECENT_KEY)).toBeNull();
    expect(readRecentWindow()).toEqual([]);
  });

  it('reads garbled storage as an empty window, keeping only whole ids', async () => {
    const { readRecentWindow } = await loadRecent();
    sessionStorage.setItem(RECENT_KEY, '{not json');
    expect(readRecentWindow()).toEqual([]);
    sessionStorage.setItem(RECENT_KEY, '[1,"2",3.5,4]');
    expect(readRecentWindow()).toEqual([1, 4]);
  });

  it('keeps the window in memory while Web Storage is blocked, and Clear forgets it (cac-eil.61)', async () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const { clearRecentWindow, readRecentWindow, writeRecentWindow } = await loadRecent();
    writeRecentWindow([7, 8]);
    expect(readRecentWindow()).toEqual([7, 8]);
    clearRecentWindow();
    expect(readRecentWindow()).toEqual([]);
  });
});
