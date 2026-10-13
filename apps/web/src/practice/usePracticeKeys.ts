import type { OptionKey } from '@cacador/data';
import { useEffect } from 'react';

const OPTION_BY_KEY: Readonly<Record<string, OptionKey>> = { a: 'A', b: 'B', c: 'C', '1': 'A', '2': 'B', '3': 'C' };

interface PracticeKeys {
  /** The current question is answered: option keys stop, Enter starts. */
  answered: boolean;
  onAnswer: (option: OptionKey) => void;
  onNext: () => void;
  onPeekChange: (peeking: boolean) => void;
}

/** Typing into a field (the flags row's note, cac-eil.14) never answers, advances or peeks. */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
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
      const option = OPTION_BY_KEY[event.key.toLowerCase()];
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
