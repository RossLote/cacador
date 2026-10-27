import type { OptionKey, Word } from '@cacador/data';
import { useId } from 'react';
import { OptionList } from '@/components/question/OptionList';
import { MOSS_PANEL, MOSS_PANEL_HEADING, MOSS_PANEL_RULE } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import type { WordOptions } from '@/model';
import { sentenceFor } from './sentence';

/** A word of the round with its options as drawn: the three English by letter, and the letter of its own. */
export interface DrawnWord extends WordOptions {
  word: Word;
}

/**
 * The panel under the answered options (DESIGN.md § 6.11), in the hint
 * panel's look: the word's note in English when it has one, then, under the
 * moss-line rule, "Question N" over the sentence it comes from, Portuguese,
 * with the phrase set in Fraunces 600 inside it.
 */
function WordPanel({ word }: { word: Word }) {
  const { t } = useI18n();
  const headingId = useId();
  const sentence = sentenceFor(word);
  return (
    <section aria-labelledby={sentence && headingId} className={MOSS_PANEL}>
      {word.note && <p lang="en">{word.note}</p>}
      {sentence && (
        <div className={cn('flex flex-col gap-1.5', word.note && MOSS_PANEL_RULE)}>
          <h2 id={headingId} className={MOSS_PANEL_HEADING}>
            {t.words.questionNumber(sentence.id)}
          </h2>
          <p lang="pt-PT" className="text-[15px]/[1.45]">
            {sentence.text.slice(0, sentence.start)}
            <span className="font-heading font-semibold">{sentence.text.slice(sentence.start, sentence.end)}</span>
            {sentence.text.slice(sentence.end)}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * The word card (DESIGN.md § 6.11), controlled like the question card: the
 * Portuguese word in Fraunces with its phrase under it, then the three
 * English options in the question card's rows. Once `selected`, the rows are
 * marked and locked and the panel opens under them. No peek, no Hint.
 */
export function WordCard({
  drawn,
  selected,
  onSelect,
}: {
  drawn: DrawnWord;
  selected: OptionKey | undefined;
  onSelect: (option: OptionKey) => void;
}) {
  const { t } = useI18n();
  const { word } = drawn;
  const answered = selected !== undefined;
  return (
    <article className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <p lang="pt-PT" className="font-heading text-[32px]/[1.15] font-semibold text-ink">
          {word.pt}
        </p>
        <p lang="pt-PT" className="text-[17px]/[1.4] text-muted-foreground">
          {word.phrase}
        </p>
      </div>
      <OptionList
        label={t.words.options}
        texts={drawn.texts}
        lang="en"
        answer={drawn.answer}
        selected={selected}
        revealed={answered}
        locked={answered}
        onSelect={onSelect}
      />
      {answered && <WordPanel word={word} />}
    </article>
  );
}
