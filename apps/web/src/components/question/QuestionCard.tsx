import { hintFor, sectionOf, topicOf, translationFor, type OptionKey, type Question } from '@cacador/data';
import { Check, Lightbulb, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { imageUrl } from '@/pwa/images';
import { OPTION_KEYS } from '@/storage';
import { HintPanel } from './HintPanel';
import { nameIn } from './names';
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
  /** Controls placed at the end of the row under the peek button, beside Hint (practice puts Next here). */
  actions?: ReactNode;
}

type Mark = 'right' | 'wrong' | 'correct';

/** The result mark an option carries: none until revealed, then the chosen one right or wrong and the answer correct. */
function markOf(option: OptionKey, question: Question, selected: OptionKey | undefined, revealed: boolean): Mark | undefined {
  if (!revealed) return undefined;
  if (option === selected) return option === question.answer ? 'right' : 'wrong';
  return option === question.answer ? 'correct' : undefined;
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
}: QuestionCardProps) {
  const { t, locale } = useI18n();
  const card = t.practice.card;
  const panelId = useId();
  const translation = translationFor(question.id);
  const english = peekEnabled && peeking && translation !== undefined ? translation : undefined;
  const shown = english ?? question;
  const textLang = english ? 'en' : 'pt-PT';
  const picture = question.image === undefined ? undefined : imageUrl(question.image);
  const place = [sectionOf(question), topicOf(question)]
    .map((entry) => entry && nameIn(entry, locale))
    .filter(Boolean)
    .join(' · ');
  const markLabel: Record<Mark, string> = { right: card.right, wrong: card.wrong, correct: card.correctAnswer };

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="text-muted-foreground">{place}</p>
        <p className="font-medium">{card.questionNumber(question.id)}</p>
      </header>

      {picture && (
        <img
          src={picture}
          alt={card.pictureAlt(question.id)}
          className="mx-auto max-h-72 w-auto max-w-full rounded-lg border object-contain"
        />
      )}

      <p lang={textLang} className="text-lg leading-snug font-medium">
        {shown.question}
      </p>

      <div role="group" aria-label={card.options} className="flex flex-col gap-2">
        {OPTION_KEYS.map((option) => {
          const mark = markOf(option, question, selected, revealed);
          const isSelected = option === selected;
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
                'h-auto min-h-14 w-full items-start justify-start gap-3 px-3 py-3 text-left text-base font-normal whitespace-normal disabled:opacity-100',
                isSelected && !revealed && 'border-foreground bg-muted dark:border-foreground dark:bg-muted',
                (mark === 'right' || mark === 'correct') &&
                  'border-success bg-success/10 dark:border-success dark:bg-success/15',
                mark === 'wrong' && 'border-destructive bg-destructive/10 dark:border-destructive dark:bg-destructive/15',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md border text-sm font-semibold',
                  isSelected && !revealed && 'border-foreground bg-foreground text-background',
                  (mark === 'right' || mark === 'correct') && 'border-success bg-success text-background',
                  mark === 'wrong' && 'border-destructive bg-destructive text-background',
                )}
              >
                {mark === 'wrong' ? <X /> : mark ? <Check /> : option}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                <span className="sr-only">{option}. </span>
                <span lang={textLang}>{shown.options[option]}</span>
                {mark && (
                  <span
                    className={cn('text-sm font-medium', mark === 'wrong' ? 'text-destructive' : 'text-success')}
                  >
                    {markLabel[mark]}
                  </span>
                )}
              </span>
            </Button>
          );
        })}
      </div>

      {peekEnabled && (
        <PeekButton label={card.holdForEnglish} peeking={peeking} onPeekChange={(next) => onPeekChange?.(next)} />
      )}

      {(hintEnabled || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {hintEnabled && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-expanded={hintOpen}
              aria-controls={hintOpen ? panelId : undefined}
              onClick={() => onHintOpen?.()}
            >
              <Lightbulb aria-hidden="true" />
              {card.hint}
            </Button>
          )}
          {actions && <div className="ml-auto flex gap-2">{actions}</div>}
        </div>
      )}

      {hintEnabled && hintOpen && <HintPanel id={panelId} hint={hintFor(question.id)} showNudge={revealed} />}
    </article>
  );
}
