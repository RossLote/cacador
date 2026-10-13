/** The languages the app is written in (phase 4 D6): English, and European Portuguese. */
export const LOCALES = ['en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

/** English on the first visit always, whatever the browser's languages say (D6). */
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language's BCP 47 tag, for `<html lang>` and number and date formats. Portuguese is pt-PT, never Brazilian. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  pt: 'pt-PT',
};

/** Each language named in itself, so a reader can find their own whatever the page is showing. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
