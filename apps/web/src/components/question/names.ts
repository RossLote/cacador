import type { Locale } from '@/i18n/locales';

/** A manifest or pattern-list name in the interface language: `pt` when the UI is Portuguese, else `en` (DESIGN.md § 6.1). */
export function nameIn(entry: { en: string; pt: string } | undefined, locale: Locale): string | undefined {
  if (entry === undefined) return undefined;
  return locale === 'pt' ? entry.pt : entry.en;
}
