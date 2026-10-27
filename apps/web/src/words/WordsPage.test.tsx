import type { Word } from '@cacador/data';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/locale';
import { MESSAGES } from '@/i18n/messages';
import { readiness, seededRandom } from '@/model';
import { getStates, listAnswers, WORDS_KEY } from '@/storage';
import { sentenceFor } from './sentence';
import { TEST_WORDS, testWord } from './testWords';
import { WordsPage } from './WordsPage';

const en = MESSAGES.en;
const t = en.words;

/** The drill on the tests' own list, with Math.random seeded as the e2e suite seeds the page's. */
function renderWords(seed = 7) {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
  return render(
    <MemoryRouter initialEntries={['/words']}>
      <WordsPage list={TEST_WORDS} />
    </MemoryRouter>,
  );
}

const card = () => screen.getByRole('article');
/** The word and its phrase: the card's first two Portuguese elements. */
const wordElement = () => card().querySelectorAll('[lang="pt-PT"]')[0] as HTMLElement;
const phraseElement = () => card().querySelectorAll('[lang="pt-PT"]')[1] as HTMLElement;

/** The list entry on screen, found by its Portuguese. */
const shownWord = (): Word => testWord(wordElement().textContent);

const optionButtons = (name = t.options) => within(screen.getByRole('group', { name })).getAllByRole('button');
/** Each option's English, A to C. */
const optionTexts = () => optionButtons().map((button) => button.querySelector('[lang="en"]')?.textContent);
const marks = () => optionButtons().map((button) => button.getAttribute('data-mark'));
const rightOption = () => optionButtons()[optionTexts().indexOf(shownWord().en)]!;
const wrongOption = () => optionButtons()[optionTexts().findIndex((text) => text !== shownWord().en)]!;
const counter = (position: number, size = 10) => screen.queryByText(t.position(position, size));
const nextButton = () => screen.queryByRole('button', { name: t.next });
const finishButton = () => screen.queryByRole('button', { name: t.finish });
const scorePlate = () => screen.queryByRole('region', { name: t.done });

/** Answers the word on screen, right or wrong, and returns it. */
async function answer(user: ReturnType<typeof userEvent.setup>, right: boolean): Promise<Word> {
  const word = shownWord();
  await user.click(right ? rightOption() : wrongOption());
  return word;
}

/** Answers the ten words of a round, every third right, and taps Finish; returns them with how each went. */
async function playRound(user: ReturnType<typeof userEvent.setup>): Promise<{ word: Word; right: boolean }[]> {
  const played: { word: Word; right: boolean }[] = [];
  for (let n = 1; n <= 10; n += 1) {
    expect(counter(n)).toBeInTheDocument();
    const right = n % 3 === 0;
    played.push({ word: await answer(user, right), right });
    if (n < 10) {
      expect(finishButton()).not.toBeInTheDocument();
      await user.click(nextButton()!);
    }
  }
  expect(nextButton()).not.toBeInTheDocument();
  await user.click(finishButton()!);
  return played;
}

describe('WordsPage', () => {
  it('opens on a word: the back control, the eyebrow Words, "1 of 10", the word in Fraunces over its phrase, three English options', () => {
    renderWords();
    expect(screen.getByRole('link', { name: en.common.backToHome })).toHaveAttribute('href', '/');
    expect(screen.getByText(t.title, { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    const position = counter(1)!;
    expect(position).toHaveTextContent('1 of 10');
    expect(position).toHaveClass('font-heading', 'text-[26px]');
    expect(position.closest('header')).toBeInTheDocument();
    expect(card()).not.toContainElement(position);

    const word = shownWord();
    expect(wordElement()).toHaveClass('font-heading', 'font-semibold');
    expect(phraseElement()).toHaveTextContent(word.phrase);
    expect(phraseElement()).toHaveAttribute('lang', 'pt-PT');
    expect(phraseElement()).not.toHaveClass('italic');

    expect(optionButtons()).toHaveLength(3);
    const texts = optionTexts();
    expect(new Set(texts).size).toBe(3);
    expect(texts.filter((text) => text === word.en)).toHaveLength(1);
    for (const text of texts) expect(TEST_WORDS.map((w) => w.en)).toContain(text);
    // Lettered A, B, C in the question card's circles.
    expect(optionButtons().map((button) => button.querySelector('[aria-hidden="true"]')?.textContent)).toEqual(['A', 'B', 'C']);
    expect(marks()).toEqual([null, null, null]);

    expect(screen.queryByRole('button', { name: en.practice.card.holdForEnglish })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.practice.card.hint })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: en.practice.flags.group })).not.toBeInTheDocument();
    expect(nextButton()).not.toBeInTheDocument();
  });

  it('marks a wrong answer Wrong and the right one Right, locks the options and opens the note and the sentence', async () => {
    const user = userEvent.setup();
    renderWords();
    const word = await answer(user, false);
    const chosen = optionButtons().findIndex((button) => button.getAttribute('aria-pressed') === 'true');
    const right = optionTexts().indexOf(word.en);
    expect(marks()[chosen]).toBe('wrong');
    expect(marks()[right]).toBe('correct');
    expect(within(optionButtons()[chosen]!).getByText(en.practice.card.wrong)).toBeInTheDocument();
    expect(within(optionButtons()[right]!).getByText(en.practice.card.right)).toBeInTheDocument();
    for (const button of optionButtons()) expect(button).toBeDisabled();

    const sentence = sentenceFor(word)!;
    const panel = screen.getByRole('region', { name: t.questionNumber(sentence.id) });
    expect(panel).toHaveClass('bg-moss');
    expect(card()).toContainElement(panel);
    const text = within(panel).getByText((_, element) => element?.tagName === 'P' && element.getAttribute('lang') === 'pt-PT');
    expect(text).toHaveTextContent(sentence.text);
    const phrase = text.querySelector('span.font-heading')!;
    expect(phrase).toHaveClass('font-semibold');
    expect(phrase.textContent?.toLowerCase()).toBe(word.phrase.toLowerCase());
    if (word.note) expect(within(panel).getByText(word.note)).toHaveAttribute('lang', 'en');
    expect(within(panel).queryByText((_, element) => element?.getAttribute('lang') === 'en' && element.textContent !== word.note)).toBeNull();

    const next = nextButton()!;
    expect(next).toHaveClass('bg-primary');
    await user.click(next);
    expect(counter(2)).toBeInTheDocument();
    expect(shownWord()).not.toBe(word);
    expect(marks()).toEqual([null, null, null]);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('shows the note when the word has one and none when it has not, the question over the sentence either way', async () => {
    const user = userEvent.setup();
    const seen = { note: false, none: false };
    renderWords(11);
    for (let n = 1; n <= 10 && !(seen.note && seen.none); n += 1) {
      const word = await answer(user, true);
      const panel = screen.getByRole('region', { name: t.questionNumber(sentenceFor(word)!.id) });
      if (word.note) {
        seen.note = true;
        const note = within(panel).getByText(word.note);
        expect(note.compareDocumentPosition(within(panel).getByRole('heading')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      } else {
        seen.none = true;
        expect(panel.querySelector('[lang="en"]')).toBeNull();
      }
      if (n < 10) await user.click(nextButton()!);
    }
    expect(seen).toEqual({ note: true, none: true });
  });

  it('answers with A to C and 1 to 3, advances with Enter, and leaves Space unbound', async () => {
    const user = userEvent.setup();
    renderWords();
    await user.keyboard(' ');
    expect(optionButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    await user.keyboard('{Enter}');
    expect(counter(1)).toBeInTheDocument();

    const first = shownWord();
    await user.keyboard('2');
    expect(optionButtons()[1]).toHaveAttribute('aria-pressed', 'true');
    expect(marks().filter(Boolean).length).toBeGreaterThan(0);
    await user.keyboard('3');
    expect(optionButtons()[2]).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard(' ');
    expect(counter(1)).toBeInTheDocument();
    expect(shownWord()).toBe(first);

    await user.keyboard('{Enter}');
    expect(counter(2)).toBeInTheDocument();
    await user.keyboard('c');
    expect(optionButtons()[2]).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Enter}');
    expect(counter(3)).toBeInTheDocument();
    await user.keyboard('A');
    expect(optionButtons()[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the keys off the back control: a key there answers nothing', async () => {
    const user = userEvent.setup();
    renderWords();
    screen.getByRole('link', { name: en.common.backToHome }).focus();
    await user.keyboard('1');
    expect(marks()).toEqual([null, null, null]);
  });

  it('finishes on the tenth: the score plate with the count right, ten rows in order with the misses marked, and Another 10', async () => {
    const user = userEvent.setup();
    renderWords();
    const played = await playRound(user);
    const right = played.filter((p) => p.right).length;

    const plate = scorePlate()!;
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(counter(10)).toBeInTheDocument();
    expect(within(plate).getByText(String(right))).toHaveClass('font-heading', 'text-[64px]');
    expect(within(plate).getByText(t.ofRight(10))).toBeInTheDocument();
    const rows = within(plate).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    rows.forEach((row, i) => {
      const { word, right: wasRight } = played[i]!;
      expect(within(row).getByText(word.pt)).toHaveAttribute('lang', 'pt-PT');
      expect(within(row).getByText(word.en)).toHaveAttribute('lang', 'en');
      if (wasRight) {
        expect(within(row).queryByText(t.missed)).not.toBeInTheDocument();
        expect(row).not.toHaveClass('bg-clay');
      } else {
        expect(within(row).getByText(t.missed)).toBeInTheDocument();
        expect(row).toHaveClass('bg-clay', 'border-rust', 'text-ink');
        expect(row.querySelector('svg.lucide-x')).toHaveClass('text-rust');
      }
    });
    expect(within(plate).getAllByText(t.missed)).toHaveLength(10 - right);
    expect(new Set(played.map((p) => p.word.pt)).size).toBe(10);
    expect(within(plate).getByRole('button', { name: t.another(10) })).toHaveClass('bg-primary');
  });

  it('carries on the pass with Another 10 and after leaving the page, never showing an answered word again', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWords();
    const answered = (await playRound(user)).map((p) => p.word.pt);
    await user.click(screen.getByRole('button', { name: t.another(10) }));
    expect(counter(1)).toBeInTheDocument();
    expect(scorePlate()).not.toBeInTheDocument();
    // The focus is on the new round's region, as after Next, not dropped to the body with the score plate.
    expect(card().parentElement).toHaveFocus();
    for (let n = 1; n <= 3; n += 1) {
      expect(answered).not.toContain(shownWord().pt);
      answered.push((await answer(user, false)).pt);
      if (n < 3) await user.click(nextButton()!);
    }
    expect(new Set(answered).size).toBe(13);
    expect(localStorage.getItem(WORDS_KEY)).not.toBeNull();

    // The round ends with the page; the next opens at "1 of 10" on a word not yet answered.
    unmount();
    renderWords();
    expect(counter(1)).toBeInTheDocument();
    expect(answered).not.toContain(shownWord().pt);
  });

  it('records nothing: the answers log stays empty and readiness reads as on a fresh device', async () => {
    const user = userEvent.setup();
    renderWords();
    await playRound(user);
    expect(await listAnswers()).toEqual([]);
    expect(readiness(await getStates())).toMatchObject({ percent: 33, unseen: 506 });
  });

  it("speaks Portuguese in its own words while the word stays Portuguese and the options English", async () => {
    const user = userEvent.setup();
    act(() => setLocale('pt'));
    renderWords();
    const pt = MESSAGES.pt.words;
    expect(screen.getByText('Palavras', { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(screen.getByText('1 de 10')).toHaveClass('font-heading');
    const word = shownWord();
    expect(wordElement()).toHaveAttribute('lang', 'pt-PT');
    const options = optionButtons(pt.options);
    expect(options).toHaveLength(3);
    const texts = options.map((button) => button.querySelector('[lang="en"]')?.textContent);
    expect(texts).toContain(word.en);
    for (const text of texts) expect(TEST_WORDS.map((w) => w.en)).toContain(text);
    await user.click(options[texts.indexOf(word.en)]!);
    expect(screen.getByRole('region', { name: pt.questionNumber(sentenceFor(word)!.id) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pt.next })).toBeInTheDocument();

    act(() => setLocale('en'));
    expect(screen.getByText('Words', { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(counter(1)).toBeInTheDocument();
  });

  it('words the Portuguese screen as the bar reads it', () => {
    const pt = MESSAGES.pt.words;
    expect([pt.title, pt.position(1, 10), pt.done, pt.ofRight(10), pt.another(10), pt.finish, pt.next]).toEqual([
      'Palavras',
      '1 de 10',
      'Ronda terminada',
      'de 10 certas',
      'Mais 10',
      'Terminar',
      'Seguinte',
    ]);
  });
});
