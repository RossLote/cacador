import { hintFor, sectionOf, topicOf, translationFor, type OptionKey, type Question } from '@cacador/data';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/locale';
import { MESSAGES } from '@/i18n/messages';
import { imageUrl } from '@/pwa/images';
import { QuestionCard, type QuestionCardProps } from './QuestionCard';
import { question, wrongOf } from '../../../test/fixtures';

const card = MESSAGES.en.practice.card;

/** Question 1 has language notes, question 6 has none, question 119 has a picture. */
const Q1 = question(1);
const Q6 = question(6);
const Q119 = question(119);
const otherWrongOf = (q: Question): OptionKey => (['A', 'B', 'C'] as const).find((k) => k !== q.answer && k !== wrongOf(q.id))!;

function renderCard(props: Partial<QuestionCardProps> = {}) {
  return render(
    <QuestionCard question={Q1} revealed={false} locked={false} peekEnabled hintEnabled {...props} />,
  );
}

const optionButtons = () => within(screen.getByRole('group', { name: card.options })).getAllByRole('button');
const optionFor = (key: OptionKey) => optionButtons()[['A', 'B', 'C'].indexOf(key)]!;
const marks = () => optionButtons().map((button) => button.getAttribute('data-mark'));
const markAt = (key: OptionKey, mark: string) =>
  (['A', 'B', 'C'] as const).map((k) => (k === key ? mark : null));

describe('QuestionCard', () => {
  it('shows the section, topic and number with showPlace, the Portuguese stem, three options, Hold for English and Hint', () => {
    renderCard({ showPlace: true });
    expect(screen.getByText(`${sectionOf(Q1)!.en} · ${topicOf(Q1)!.en}`)).toBeInTheDocument();
    expect(screen.getByText(card.questionNumber(1))).toBeInTheDocument();
    expect(screen.getByText(Q1.question)).toHaveAttribute('lang', 'pt-PT');
    expect(optionButtons()).toHaveLength(3);
    for (const key of ['A', 'B', 'C'] as const) expect(optionFor(key)).toHaveTextContent(Q1.options[key]);
    expect(screen.getByRole('button', { name: card.holdForEnglish })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: card.hint })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('names the section and topic in Portuguese when the interface is', () => {
    act(() => setLocale('pt'));
    renderCard({ showPlace: true });
    expect(screen.getByText(`${sectionOf(Q1)!.pt} · ${topicOf(Q1)!.pt}`)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.pt.practice.card.questionNumber(1))).toBeInTheDocument();
  });

  it('shows the picture from the image map when the question has one', () => {
    renderCard({ question: Q119 });
    expect(screen.getByRole('img', { name: card.pictureAlt(119) })).toHaveAttribute('src', imageUrl(Q119.image!));
  });

  it('shows the selection and marks nothing while the result is not revealed', async () => {
    const onSelect = vi.fn();
    renderCard({ selected: wrongOf(Q1.id), onSelect });
    expect(marks()).toEqual([null, null, null]);
    expect(optionFor(wrongOf(Q1.id))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(card.correctAnswer)).not.toBeInTheDocument();
    expect(screen.queryByText(card.wrong)).not.toBeInTheDocument();
    for (const button of optionButtons()) expect(button).toBeEnabled();
    await userEvent.click(optionFor(Q1.answer));
    expect(onSelect).toHaveBeenCalledWith(Q1.answer);
  });

  it('marks only the correct option when revealed with nothing selected', () => {
    renderCard({ revealed: true, locked: true });
    expect(marks()).toEqual(markAt(Q1.answer, 'correct'));
    expect(within(optionFor(Q1.answer)).getByText(card.correctAnswer)).toBeInTheDocument();
  });

  it('marks a wrong choice wrong and the correct option, and locks the options', () => {
    const onSelect = vi.fn();
    renderCard({ selected: wrongOf(Q1.id), revealed: true, locked: true, onSelect });
    expect(within(optionFor(wrongOf(Q1.id))).getByText(card.wrong)).toBeInTheDocument();
    expect(within(optionFor(Q1.answer)).getByText(card.correctAnswer)).toBeInTheDocument();
    expect(optionFor(otherWrongOf(Q1))).not.toHaveAttribute('data-mark');
    for (const button of optionButtons()) expect(button).toBeDisabled();
    fireEvent.click(optionFor(Q1.answer));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks a right choice right', () => {
    renderCard({ selected: Q1.answer, revealed: true, locked: true });
    expect(marks()).toEqual(markAt(Q1.answer, 'right'));
    expect(within(optionFor(Q1.answer)).getByText(card.right)).toBeInTheDocument();
  });

  describe('the look (DESIGN.md § 8.6)', () => {
    const letterOf = (key: OptionKey) => optionFor(key).querySelector('[aria-hidden="true"]')!;

    it('draws a wrong answer: the chosen row clay with a rust hairline, a cross and Wrong; the correct row moss with a tick and Right', () => {
      renderCard({ selected: wrongOf(Q1.id), revealed: true, locked: true });
      const wrong = optionFor(wrongOf(Q1.id));
      expect(wrong).toHaveClass('bg-clay', 'border-rust', 'text-ink');
      expect(letterOf(wrongOf(Q1.id))).toHaveClass('bg-rust', 'text-on-fill');
      expect(letterOf(wrongOf(Q1.id))).toHaveTextContent(wrongOf(Q1.id));
      expect(wrong.querySelector('svg.lucide-x')).toHaveClass('text-rust');
      expect(within(wrong).getByText(card.wrong)).toHaveClass('text-ink');

      const right = optionFor(Q1.answer);
      expect(right).toHaveClass('bg-moss', 'border-forest');
      expect(letterOf(Q1.answer)).toHaveClass('bg-forest', 'text-on-fill');
      expect(right.querySelector('svg.lucide-check')).toBeInTheDocument();
      // On screen the correct row reads Right; its accessible text stays "Correct answer".
      expect(within(right).getByText(card.right)).toHaveAttribute('aria-hidden', 'true');
      expect(within(right).getByText(card.correctAnswer)).toHaveClass('sr-only');
      expect(right).toHaveAccessibleName(expect.stringContaining(card.correctAnswer));

      const other = optionFor(otherWrongOf(Q1));
      expect(other).not.toHaveClass('bg-moss');
      expect(other).not.toHaveClass('bg-clay');
      expect(other.querySelector('svg')).toBeNull();
    });

    it('draws a right choice moss with Right as its accessible word too', () => {
      renderCard({ selected: Q1.answer, revealed: true, locked: true });
      expect(optionFor(Q1.answer)).toHaveClass('bg-moss', 'border-forest');
      expect(within(optionFor(Q1.answer)).getByText(card.right)).not.toHaveAttribute('aria-hidden');
      expect(screen.queryByText(card.correctAnswer)).not.toBeInTheDocument();
    });

    it('fills the chosen row ink with a card-outlined letter and no Right or Wrong while unrevealed', () => {
      renderCard({ selected: wrongOf(Q1.id), peekEnabled: false, hintEnabled: false });
      expect(optionFor(wrongOf(Q1.id))).toHaveClass('bg-ink', 'text-card', 'border-ink');
      expect(letterOf(wrongOf(Q1.id))).toHaveClass('border-card');
      expect(letterOf(wrongOf(Q1.id))).not.toHaveClass('bg-rust');
      expect(optionFor(Q1.answer)).not.toHaveClass('bg-ink');
      expect(optionFor(Q1.answer)).not.toHaveClass('bg-moss');
      for (const word of [card.right, card.wrong, card.correctAnswer]) expect(screen.queryByText(word)).not.toBeInTheDocument();
      for (const button of optionButtons()) expect(button.querySelector('svg')).toBeNull();
    });

    it('letters every option in a circle', () => {
      renderCard();
      for (const key of ['A', 'B', 'C'] as const) {
        expect(letterOf(key)).toHaveTextContent(key);
        expect(letterOf(key)).toHaveClass('rounded-full', 'font-heading', 'border-ink');
      }
    });

    it('puts the picture whole on a plate no taller than 240 px, never cropped', () => {
      renderCard({ question: Q119 });
      const img = screen.getByRole('img', { name: card.pictureAlt(119) });
      expect(img).toHaveClass('object-contain', 'max-h-[222px]', 'max-w-full', 'w-auto', 'h-auto');
      expect(img).not.toHaveClass('object-cover');
      // 222 px of picture, 8 px of padding above and below and the two hairlines: 240 px.
      expect(img.parentElement?.tagName).toBe('FIGURE');
      expect(img.parentElement).toHaveClass('p-2', 'border', 'rounded-lg', 'bg-card');
    });

    it('sets the stem in Fraunces', () => {
      renderCard();
      expect(screen.getByText(Q1.question)).toHaveClass('font-heading', 'text-2xl/[1.25]', 'font-semibold');
    });

    it('opens the hint panel as a moss plate with the Language notes eyebrow, and the Nudge under a rule once revealed', () => {
      renderCard({ hintOpen: true, revealed: true, locked: true });
      const panel = screen.getByRole('region', { name: card.hint });
      expect(panel).toHaveClass('bg-moss', 'rounded-lg');
      expect(panel).not.toHaveClass('border');
      expect(within(panel).getByRole('heading', { name: card.languageNotes })).toHaveClass('text-forest', 'uppercase');
      const nudge = within(panel).getByRole('heading', { name: card.nudge });
      expect(nudge).toHaveClass('text-forest');
      expect(nudge.parentElement).toHaveClass('border-t', 'border-moss-line');
      expect(within(panel).getByText(hintFor(1)!.language[0]!.pt)).toHaveClass('font-heading');
    });

    it('leaves the section, topic and number to the page by default', () => {
      renderCard();
      expect(screen.queryByText(card.questionNumber(1))).not.toBeInTheDocument();
      expect(screen.queryByText(`${sectionOf(Q1)!.en} · ${topicOf(Q1)!.en}`)).not.toBeInTheDocument();
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
    });
  });

  it('leaves the peek and Hint buttons out when they are disabled, and never shows English then', () => {
    renderCard({ peekEnabled: false, hintEnabled: false, peeking: true, hintOpen: true });
    expect(screen.queryByRole('button', { name: card.holdForEnglish })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: card.hint })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: card.hint })).not.toBeInTheDocument();
    expect(screen.getByText(Q1.question)).toBeInTheDocument();
  });

  it('shows the English stem and options while peeking', () => {
    const english = translationFor(1)!;
    renderCard({ peeking: true });
    expect(screen.getByText(english.question)).toHaveAttribute('lang', 'en');
    expect(screen.queryByText(Q1.question)).not.toBeInTheDocument();
    for (const key of ['A', 'B', 'C'] as const) expect(optionFor(key)).toHaveTextContent(english.options[key]);
  });

  describe('the hold button', () => {
    function Peekable() {
      const [peeking, setPeeking] = useState(false);
      return <QuestionCard question={Q1} revealed={false} locked={false} peekEnabled peeking={peeking} onPeekChange={setPeeking} hintEnabled={false} />;
    }
    const english = translationFor(1)!.question;
    const hold = () => screen.getByRole('button', { name: card.holdForEnglish });

    it('shows the English for as long as it is held and the Portuguese on release', async () => {
      const user = userEvent.setup();
      render(<Peekable />);
      await user.pointer({ keys: '[MouseLeft>]', target: hold() });
      expect(screen.getByText(english)).toBeInTheDocument();
      await user.pointer({ keys: '[/MouseLeft]', target: hold() });
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
      expect(screen.queryByText(english)).not.toBeInTheDocument();
    });

    it('turns ink while held and back on release', async () => {
      const user = userEvent.setup();
      render(<Peekable />);
      expect(hold()).not.toHaveAttribute('data-peeking');
      expect(hold()).toHaveClass('data-peeking:bg-ink', 'data-peeking:text-card');
      await user.pointer({ keys: '[MouseLeft>]', target: hold() });
      expect(hold()).toHaveAttribute('data-peeking');
      await user.pointer({ keys: '[/MouseLeft]', target: hold() });
      expect(hold()).not.toHaveAttribute('data-peeking');
    });

    it('is never a toggle: a click leaves the Portuguese', async () => {
      render(<Peekable />);
      await userEvent.click(hold());
      await userEvent.click(hold());
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
    });

    it('returns the Portuguese when the pointer leaves the button while held', async () => {
      const user = userEvent.setup();
      render(<Peekable />);
      await user.pointer({ keys: '[MouseLeft>]', target: hold() });
      expect(screen.getByText(english)).toBeInTheDocument();
      await user.pointer({ target: document.body });
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
    });

    it('returns the Portuguese on pointercancel, and blocks the long-press menu', () => {
      render(<Peekable />);
      fireEvent.pointerDown(hold(), { pointerType: 'touch' });
      expect(screen.getByText(english)).toBeInTheDocument();
      expect(fireEvent.contextMenu(hold())).toBe(false);
      fireEvent.pointerCancel(hold(), { pointerType: 'touch' });
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
    });

    it('ignores a right-click', () => {
      render(<Peekable />);
      fireEvent.pointerDown(hold(), { pointerType: 'mouse', button: 2 });
      expect(screen.getByText(Q1.question)).toBeInTheDocument();
    });
  });

  describe('the hint panel', () => {
    const panel = () => screen.queryByRole('region', { name: card.hint });

    it('stays closed until the page opens it, and asks the page when Hint is tapped', async () => {
      const onHintOpen = vi.fn();
      renderCard({ onHintOpen });
      expect(panel()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: card.hint })).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(screen.getByRole('button', { name: card.hint }));
      expect(onHintOpen).toHaveBeenCalledOnce();
    });

    it('shows the language notes and never the nudge before the result is revealed', () => {
      const hint = hintFor(1)!;
      renderCard({ hintOpen: true, selected: Q1.answer });
      expect(screen.getByRole('button', { name: card.hint })).toHaveAttribute('aria-expanded', 'true');
      const region = within(panel()!);
      expect(region.getByText(hint.language[0]!.pt)).toBeInTheDocument();
      expect(region.getByText(hint.language[0]!.en)).toBeInTheDocument();
      expect(region.getByText(hint.language[0]!.note)).toBeInTheDocument();
      expect(region.queryByText(hint.nudge)).not.toBeInTheDocument();
      expect(region.queryByText(card.nudge)).not.toBeInTheDocument();
    });

    it('says there are no notes when the list is empty', () => {
      expect(hintFor(6)!.language).toEqual([]);
      renderCard({ question: Q6, hintOpen: true });
      expect(within(panel()!).getByText(card.noLanguageNotes)).toBeInTheDocument();
    });

    it('adds the nudge once revealed', () => {
      renderCard({ hintOpen: true, revealed: true, locked: true });
      expect(within(panel()!).getByText(hintFor(1)!.nudge)).toBeInTheDocument();
    });
  });

  it('handles no keys: letters, digits, Enter and Space do nothing', async () => {
    const onSelect = vi.fn();
    const onPeekChange = vi.fn();
    const onHintOpen = vi.fn();
    renderCard({ onSelect, onPeekChange, onHintOpen });
    await userEvent.keyboard('abc123{Enter}');
    await userEvent.keyboard('[Space>]');
    await userEvent.keyboard('[/Space]');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onPeekChange).not.toHaveBeenCalled();
    expect(onHintOpen).not.toHaveBeenCalled();
  });
});
