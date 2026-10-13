import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_KEY } from '@/storage/keys';
import { LOCALES } from './locales';
import { MESSAGES } from './messages';

/** Every leaf of a messages object, as `path: value` (a function leaf stands as its type). */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'function') return [[path, 'function']];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

/** A fresh copy of the locale store, so its first read of storage runs again. */
async function freshStore() {
  vi.resetModules();
  return import('./locale');
}

describe('locale store', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
  });

  it('starts in English on a first visit whatever the browser prefers', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'pt-PT', languages: ['pt-PT', 'pt'] });
    const { getLocale } = await freshStore();
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en-GB');
  });

  it('keeps the chosen language under cacador.locale and reads it back on the next visit', async () => {
    const first = await freshStore();
    const heard = vi.fn();
    first.subscribeLocale(heard);
    first.setLocale('pt');
    expect(heard).toHaveBeenCalledOnce();
    expect(localStorage.getItem(LOCALE_KEY)).toBe('pt');
    expect(LOCALE_KEY).toBe('cacador.locale');

    const second = await freshStore();
    expect(second.getLocale()).toBe('pt');
  });

  it('sets <html lang> to the chosen language', async () => {
    const { setLocale } = await freshStore();
    setLocale('pt');
    expect(document.documentElement.lang).toBe('pt-PT');
    setLocale('en');
    expect(document.documentElement.lang).toBe('en-GB');
  });

  it('ignores a stored value that is not a language', async () => {
    localStorage.setItem(LOCALE_KEY, 'pt-BR');
    const { getLocale } = await freshStore();
    expect(getLocale()).toBe('en');
  });
});

describe('messages', () => {
  it('gives Portuguese the same keys as English, none of them empty', () => {
    const english = leaves(MESSAGES.en).map(([path]) => path);
    for (const locale of LOCALES) {
      const entries = leaves(MESSAGES[locale]);
      expect(entries.map(([path]) => path)).toEqual(english);
      for (const [path, text] of entries) expect(text, `${locale} ${path}`).not.toBe('');
    }
  });
});
