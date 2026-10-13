import type { Locale } from '@/i18n/locales';
import type { BilingualName } from '@/model';

/** A manifest or pattern-list name in the interface language: `pt` when the UI is Portuguese, else `en` (DESIGN.md § 6.1). */
export function nameIn(entry: BilingualName, locale: Locale): string {
  return locale === 'pt' ? entry.pt : entry.en;
}
