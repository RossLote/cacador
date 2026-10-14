import { sectionOf, topicOf, type Question } from '@cacador/data';
import type { Locale } from '@/i18n/locales';
import type { BilingualName } from '@/model';

/** A manifest or pattern-list name in the interface language: `pt` when the UI is Portuguese, else `en` (DESIGN.md § 6.1). */
export function nameIn(entry: BilingualName, locale: Locale): string {
  return locale === 'pt' ? entry.pt : entry.en;
}

/** Where a question sits in the bank, "<section> · <topic>" in the interface language (DESIGN.md § 6.4). */
export function placeOf(question: Question, locale: Locale): string {
  return [sectionOf(question), topicOf(question)]
    .map((entry) => entry && nameIn(entry, locale))
    .filter(Boolean)
    .join(' · ');
}
