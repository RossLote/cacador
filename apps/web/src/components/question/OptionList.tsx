import type { OptionKey } from '@cacador/data';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { OPTION_KEYS } from '@/storage';

type Mark = 'right' | 'wrong' | 'correct';

/** The result mark an option carries: none until revealed, then the chosen one right or wrong and the answer correct. */
function markOf(option: OptionKey, answer: OptionKey, selected: OptionKey | undefined, revealed: boolean): Mark | undefined {
  if (!revealed) return undefined;
  if (option === selected) return option === answer ? 'right' : 'wrong';
  return option === answer ? 'correct' : undefined;
}

/**
 * The look of each row state (DESIGN.md § 8.6): the row, then its letter circle.
 * Plain: card with the hairline, the letter outlined in ink. Chosen while
 * unrevealed (the running exam): filled ink, card text, the letter outlined in
 * card. Right or correct: moss with a forest hairline, the letter filled
 * forest. Wrong: clay with a rust hairline, the letter filled rust; the text
 * on clay stays ink (§ 8.5).
 */
const ROW = {
  plain: { row: '', letter: 'border-ink' },
  chosen: { row: 'border-ink bg-ink text-card hover:bg-ink', letter: 'border-card' },
  right: { row: 'border-forest bg-moss text-ink', letter: 'border-forest bg-forest text-on-fill' },
  wrong: { row: 'border-rust bg-clay text-ink', letter: 'border-rust bg-rust text-on-fill' },
} as const;

function rowLook(mark: Mark | undefined, chosen: boolean): (typeof ROW)[keyof typeof ROW] {
  if (mark === 'wrong') return ROW.wrong;
  if (mark !== undefined) return ROW.right;
  return chosen ? ROW.chosen : ROW.plain;
}

/**
 * The word and icon at the end of a revealed row: a forest tick and "Right" on
 * the correct row, a rust cross and "Wrong" (in ink) on the chosen wrong one.
 * The correct row the learner did not choose reads "Right" on screen and
 * "Correct answer" to a screen reader, the name it has always had (D12).
 */
function MarkWord({ mark }: { mark: Mark }) {
  const { t } = useI18n();
  const card = t.practice.card;
  return (
    <span className="flex shrink-0 items-center gap-1 self-center text-[13px] font-bold">
      {mark === 'wrong' ? (
        <>
          <X aria-hidden="true" className="size-5 text-rust" strokeWidth={1.75} />
          <span className="text-ink">{card.wrong}</span>
        </>
      ) : (
        <span className="flex items-center gap-1 text-forest">
          <Check aria-hidden="true" className="size-5" strokeWidth={1.75} />
          {mark === 'right' ? (
            card.right
          ) : (
            <>
              <span aria-hidden="true">{card.right}</span>
              <span className="sr-only">{card.correctAnswer}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

export interface OptionListProps {
  /** The group's accessible name, "Options" in the interface language. */
  label: string;
  /** Each row's text by its letter. */
  texts: Readonly<Record<OptionKey, string>>;
  /** The language of the texts: pt-PT for the bank, en for a peek or the words drill's English. */
  lang: string;
  /** The right option. */
  answer: OptionKey;
  /** The option picked, shown as picked; undefined while nothing is. */
  selected?: OptionKey;
  /** Mark the result: the selected option right or wrong, and the correct option (even with nothing selected). */
  revealed: boolean;
  /** Options can no longer be tapped. */
  locked: boolean;
  /** An option was tapped (never called while locked). */
  onSelect?: (option: OptionKey) => void;
}

/**
 * The three option rows lettered A, B, C (DESIGN.md § 8.6), shared by the
 * question card and the words drill (§ 6.11): a group of buttons, each
 * carrying `data-mark` (right, wrong or correct) once the result is revealed.
 * Controlled, like the card: it records nothing and handles no keys.
 */
export function OptionList({ label, texts, lang, answer, selected, revealed, locked, onSelect }: OptionListProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {OPTION_KEYS.map((option) => {
        const mark = markOf(option, answer, selected, revealed);
        const isSelected = option === selected;
        const look = rowLook(mark, isSelected && !revealed);
        return (
          <Button
            key={option}
            type="button"
            variant="outline"
            disabled={locked}
            aria-pressed={isSelected}
            data-mark={mark}
            onClick={() => onSelect?.(option)}
            className={cn(
              'h-auto min-h-14 w-full justify-start gap-3 px-3.5 py-3 text-left text-[17px]/[1.35] font-normal whitespace-normal disabled:opacity-100',
              look.row,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border font-heading text-[15px] font-semibold',
                look.letter,
              )}
            >
              {option}
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">{option}. </span>
              <span lang={lang}>{texts[option]}</span>
            </span>
            {mark && <MarkWord mark={mark} />}
          </Button>
        );
      })}
    </div>
  );
}
