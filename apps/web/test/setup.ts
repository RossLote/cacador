import '@testing-library/jest-dom/vitest';
// IndexedDB and its key ranges, which jsdom lacks.
import 'fake-indexeddb/auto';
import { act, cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { closeStorage } from '@/storage';

/**
 * Every test starts on an empty device: the storage module's connection closed
 * over a fresh IndexedDB, empty Web Storage, the UI in English, and no stub or
 * spy left from the test before. A test that needs something else (no
 * IndexedDB, a fresh device halfway through) sets it up itself. The
 * node-environment tests (a Vite build) have no DOM and nothing to reset.
 */
const hasDom = typeof window !== 'undefined';

// The locale store reads localStorage as it loads, so it is loaded only where there is a DOM.
const locale = hasDom ? await import('@/i18n/locale') : undefined;

beforeEach(async () => {
  if (!hasDom) return;
  await closeStorage();
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(async () => {
  cleanup();
  if (locale === undefined) return;
  act(() => locale.setLocale('en'));
  await closeStorage();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
