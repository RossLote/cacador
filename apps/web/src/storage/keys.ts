/**
 * The app's three Web Storage keys (phase 4 D16): the storage module owns their
 * names and the screens import them from here. Every key starts with `cacador.`.
 */

/** localStorage: the UI language, `en` or `pt` (D6). Clear progress never removes it. */
export const LOCALE_KEY = 'cacador.locale';

/** sessionStorage: the no-repeat window of recently drawn question ids (D4, D5). */
export const RECENT_KEY = 'cacador.recent';

/** localStorage: the words drill's shuffled pass and the place in it (DESIGN.md § 6.11, § 7). Clear progress removes it. */
export const WORDS_KEY = 'cacador.words';
