import { useSyncExternalStore } from 'react';
import { getLocale, setLocale, subscribeLocale } from './locale';
import { MESSAGES } from './messages';

/** `t` is the current language's messages; changing the language re-renders every component using it. */
export function useI18n() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return { t: MESSAGES[locale], locale, setLocale };
}
