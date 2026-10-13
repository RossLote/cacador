import { useEffect } from 'react';
import { OPTION_KEYS, type OptionKey } from '@/storage';

/** Each option by its letter (a, b, c) and by its place (1, 2, 3). */
const OPTION_BY_KEY: ReadonlyMap<string, OptionKey> = new Map(
  OPTION_KEYS.flatMap((option, i) => [
    [option.toLowerCase(), option],
    [String(i + 1), option],
  ]),
);

interface PracticeKeys {
  /** The current question is answered: option keys stop, Enter starts. */
  answered: boolean;
  onAnswer: (option: OptionKey) => void;
  onNext: () => void;
  onPeekChange: (peeking: boolean) => void;
}

/** Marks a region whose controls keep their own keys (the flags row): Enter and Space reach its buttons. */
export const OWN_KEYS_ATTRIBUTE = 'data-own-keys';

/**
 * Typing into a field, or using a control inside a region marked
 * OWN_KEYS_ATTRIBUTE (the flags row, cac-eil.14), never answers, advances or peeks.
 */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.closest(`[${OWN_KEYS_ATTRIBUTE}]`) !== null)
  );
}

/**
 * The laptop keys of the practice page (D9), never the card's: A, B, C and
 * 1, 2, 3 answer while unanswered; Enter advances once answered; Space peeks
 * from keydown to keyup (repeats ignored, never a toggle, the page does not
 * scroll). Losing the window or the tab also ends a peek, so the English is
 * never left on.
 */
export function usePracticeKeys({ answered, onAnswer, onNext, onPeekChange }: PracticeKeys): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
      if (event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) onPeekChange(true);
        return;
      }
      if (event.key === 'Enter') {
        if (!answered) return;
        event.preventDefault();
        if (!event.repeat) onNext();
        return;
      }
      const option = OPTION_BY_KEY.get(event.key.toLowerCase());
      if (option === undefined || answered) return;
      event.preventDefault();
      if (!event.repeat) onAnswer(option);
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      // A focused button would otherwise click on Space's keyup.
      if (!isTextEntry(event.target)) event.preventDefault();
      onPeekChange(false);
    };
    const stopPeek = () => onPeekChange(false);
    const hidden = () => {
      if (document.visibilityState === 'hidden') onPeekChange(false);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', stopPeek);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', stopPeek);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [answered, onAnswer, onNext, onPeekChange]);
}
