/**
 * App-wide language: a tiny module-level store (read with useSyncExternalStore)
 * persisted in localStorage under `cacador.locale`. With nothing stored the app
 * starts in English, never from the browser's languages (phase 4 D6).
 * `<html lang>` follows it.
 */
import { LOCALE_KEY } from '@/storage/keys';
import { DEFAULT_LOCALE, isLocale, LOCALE_TAGS, type Locale } from './locales';

/** The stored language; storage that is blocked or holds anything else gives the default. */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function applyLang(next: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_TAGS[next];
}

let locale = initialLocale();
applyLang(locale);
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  try {
    localStorage.setItem(LOCALE_KEY, next);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
  applyLang(next);
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
