import { hintFor, translationFor, type OptionKey, type Question } from '@cacador/data';
import { Check, Lightbulb, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { imageUrl } from '@/pwa/images';
import { OPTION_KEYS } from '@/storage';
import { HintPanel } from './HintPanel';
import { placeOf } from './names';
import { PeekButton } from './PeekButton';

/**
 * The question card (phase 4 D20, DESIGN.md § 8.6), a controlled component:
 * the page decides every state and the card only draws it. It records
 * nothing and handles no keys (D9).
 *
 * - Practice: `revealed` and `locked` once an option is tapped, peek and hint on.
 * - Running exam: `selected` shown, `revealed` and `locked` false, peek and hint off.
 * - Exam review: `revealed` and `locked`, peek and hint on.
 */
export interface QuestionCardProps {
  question: Question;
  /** The option picked, shown as picked; undefined while nothing is. */
  selected?: OptionKey;
  /** Mark the result: the selected option right or wrong, and the correct option (even with nothing selected). */
  revealed: boolean;
  /** Options can no longer be tapped. */
  locked: boolean;
  /** An option was tapped (never called while locked). */
  onSelect?: (option: OptionKey) => void;
  /** Render the hold-for-English button; when false it is absent and the card never shows English. */
  peekEnabled: boolean;
  /** Show the English stem and options; the page owns it so a key (Space) and the button share one state. */
  peeking?: boolean;
  /** The button asks to start (true) or stop (false) peeking. */
  onPeekChange?: (peeking: boolean) => void;
  /** Render the Hint button and its panel; when false both are absent. */
  hintEnabled: boolean;
  /** The hint panel is open; the page owns it so Next can close it (D23). */
  hintOpen?: boolean;
  /** The Hint button was tapped. The panel never closes from the card, only when the page says so. */
  onHintOpen?: () => void;
  /** Controls placed at the foot of the card, under the hint panel. */
  actions?: ReactNode;
  /**
   * Show the section · topic and "Question N" over the picture (the default).
   * Practice passes false and shows them in its screen header instead (D6).
   */
  showPlace?: boolean;
}

type Mark = 'right' | 'wrong' | 'correct';

/** The result mark an option carries: none until revealed, then the chosen one right or wrong and the answer correct. */
function markOf(option: OptionKey, question: Question, selected: OptionKey | undefined, revealed: boolean): Mark | undefined {
  if (!revealed) return undefined;
  if (option === selected) return option === question.answer ? 'right' : 'wrong';
  return option === question.answer ? 'correct' : undefined;
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
          <X aria-hidden="true" className="size-5 text-rust" />
          <span className="text-ink">{card.wrong}</span>
        </>
      ) : (
        <span className="flex items-center gap-1 text-forest">
          <Check aria-hidden="true" className="size-5" />
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

export function QuestionCard({
  question,
  selected,
  revealed,
  locked,
  onSelect,
  peekEnabled,
  peeking = false,
  onPeekChange,
  hintEnabled,
  hintOpen = false,
  onHintOpen,
  actions,
  showPlace = true,
}: QuestionCardProps) {
  const { t, locale } = useI18n();
  const card = t.practice.card;
  const panelId = useId();
  const translation = translationFor(question.id);
  const english = peekEnabled && peeking && translation !== undefined ? translation : undefined;
  const shown = english ?? question;
  const textLang = english ? 'en' : 'pt-PT';
  const picture = question.image === undefined ? undefined : imageUrl(question.image);

  return (
    <article className="flex flex-col gap-3.5">
      {showPlace && (
        <header className="flex flex-col gap-0.5">
          <p className="eyebrow">{placeOf(question, locale)}</p>
          <p className="font-heading text-base text-muted-foreground">{card.questionNumber(question.id)}</p>
        </header>
      )}

      {picture && (
        // The plate: whole and centred, never cropped, the plate at most 240 px tall (8 px padding and the hairline included).
        <figure className="m-0 flex justify-center rounded-lg border border-line bg-card p-2">
          <img
            src={picture}
            alt={card.pictureAlt(question.id)}
            className="block h-auto max-h-[222px] w-auto max-w-full rounded-sm object-contain"
          />
        </figure>
      )}

      <p lang={textLang} className="font-heading text-2xl/[1.25] font-semibold text-ink">
        {shown.question}
      </p>

      <div role="group" aria-label={card.options} className="flex flex-col gap-2">
        {OPTION_KEYS.map((option) => {
          const mark = markOf(option, question, selected, revealed);
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
                <span lang={textLang}>{shown.options[option]}</span>
              </span>
              {mark && <MarkWord mark={mark} />}
            </Button>
          );
        })}
      </div>

      {(peekEnabled || hintEnabled) && (
        <div className={cn('grid gap-2.5', peekEnabled && hintEnabled && 'grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
          {peekEnabled && (
            <PeekButton label={card.holdForEnglish} peeking={peeking} onPeekChange={(next) => onPeekChange?.(next)} />
          )}
          {hintEnabled && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-auto min-h-12 w-full gap-2 px-3 py-3 whitespace-normal aria-expanded:bg-card"
              aria-expanded={hintOpen}
              aria-controls={hintOpen ? panelId : undefined}
              onClick={() => onHintOpen?.()}
            >
              <Lightbulb aria-hidden="true" />
              {card.hint}
            </Button>
          )}
        </div>
      )}

      {hintEnabled && hintOpen && <HintPanel id={panelId} hint={hintFor(question.id)} showNudge={revealed} />}

      {actions}
    </article>
  );
}
