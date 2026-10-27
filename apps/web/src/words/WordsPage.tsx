import { words as bankWords, type OptionKey, type Word } from '@cacador/data';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDock } from '@/components/nav/dock';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { RoundCounter } from '@/components/round/RoundCounter';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { wordOptions } from '@/model';
import { usePracticeKeys } from '@/practice/usePracticeKeys';
import { nextRoundWords, spendWord } from '@/storage';
import { WordCard, type DrawnWord } from './WordCard';
import { WordsSummary } from './WordsSummary';

/**
 * The next round (D10, D12): the pass's next words, none spent yet, each with
 * its three options drawn once, A to C, so the rows stay put while it is on
 * screen. Both draws take Math.random, which the e2e suite seeds.
 */
function startRound(list: readonly Word[]): DrawnWord[] {
  return nextRoundWords(list).map((word) => ({ word, ...wordOptions(word, list) }));
}

/** Back to the top of the page with the focus on the page's region, so the keys answer the next word at once. */
function toTop(region: HTMLElement | null): void {
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  region?.focus({ preventScroll: true });
}

/**
 * The words drill (DESIGN.md § 6.11, epic cac-zqe D9, D10, D15) at /words:
 * rounds of ten words from the pass, each a Portuguese word with three English
 * options. Tapping an option (or A, B, C, 1, 2, 3) marks the rows, locks them,
 * spends the word and opens the panel with its note and sentence; Next (or
 * Enter) shows the next word, and on the tenth Finish shows the score in place
 * of the card, where Another starts the next round on the same screen. The
 * screen header carries the eyebrow Words and the counter. Nothing is recorded
 * but the place in the pass: the round's tally lives here, so leaving or
 * reloading the page ends it, and the next round opens on the first word not
 * yet answered.
 *
 * `list` is the words to draw from, the loader's by default; the tests pass
 * their own.
 */
export function WordsPage({ list = bankWords }: { list?: readonly Word[] }) {
  const { t } = useI18n();
  const [round, setRound] = useState(() => startRound(list));
  /** The word on screen's place in the round, from 0; the round's length once its score is on screen. */
  const [place, setPlace] = useState(0);
  /** The option picked for each word answered, in the round's order. */
  const [picks, setPicks] = useState<readonly OptionKey[]>([]);
  /** The word already answered, so a second tap or key in the same frame changes nothing. */
  const answeredWord = useRef<DrawnWord>(undefined);
  const top = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);

  const drawn = round[place];
  /** The option picked for the word on screen; undefined until it is answered. */
  const selected = picks[place];
  const answered = selected !== undefined;
  const last = place === round.length - 1;
  /** The round is over and its score is on screen in place of the card. */
  const scored = round.length > 0 && place === round.length;

  const answer = useCallback(
    (option: OptionKey) => {
      if (drawn === undefined || answeredWord.current === drawn) return;
      answeredWord.current = drawn;
      setPicks((was) => [...was, option]);
      spendWord(list, drawn.word);
    },
    [drawn, list],
  );

  // The panel and Next open under the options: bring them into view.
  useEffect(() => {
    if (answered) result.current?.scrollIntoView({ block: 'nearest' });
  }, [answered]);

  const next = useCallback(() => {
    setPlace((was) => was + 1);
    toTop(top.current);
  }, []);

  const finish = useCallback(() => {
    setPlace(round.length);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [round.length]);

  const another = useCallback(() => {
    setRound(startRound(list));
    setPlace(0);
    setPicks([]);
    toTop(top.current);
  }, [list]);

  const dock = useDock();
  usePracticeKeys({ answered, onAnswer: answer, onNext: last ? finish : next, region: top, dock });

  const header = (
    <ScreenHeader
      eyebrow={t.words.title}
      heading={t.words.title}
      aside={round.length > 0 && <RoundCounter label={t.words.position(scored ? round.length : place + 1, round.length)} />}
    />
  );

  if (scored) {
    return (
      <div className="flex flex-col gap-3.5">
        {header}
        <WordsSummary
          words={round.map((entry) => entry.word)}
          right={round.map((entry, i) => picks[i] === entry.answer)}
          onAnother={another}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {header}
      <div ref={top} tabIndex={-1} className="flex flex-col gap-3.5 outline-none">
        {drawn && <WordCard drawn={drawn} selected={selected} onSelect={answer} />}
        {answered && (
          <div ref={result} className="mt-1">
            <Button type="button" size="lg" className="h-13 w-full text-[17px]" onClick={last ? finish : next}>
              {last ? t.words.finish : t.words.next}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
