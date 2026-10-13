import { hintFor, sectionOf, topicOf, translationFor, type OptionKey } from '@cacador/data';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { RECENT_LIMIT } from '@/model';
import { closeStorage, listAnswers, RECENT_KEY } from '@/storage';
import { PracticePage } from './PracticePage';
import { question, wrongOf } from '../../test/fixtures';

const t = MESSAGES.en.practice;
const card = t.card;

/**
 * Practice with Math.random at 0, which always takes the first candidate in
 * pool order, so on a fresh device the draws run 1, 2, 3… and only the recent
 * window stops the first question coming back.
 */
function renderPractice() {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  return render(
    <MemoryRouter initialEntries={['/practice']}>
      <PracticePage />
    </MemoryRouter>,
  );
}

/** The number of the question on screen, once one is. */
async function shownId(): Promise<number> {
  const label = await screen.findByText(/^Question \d+$/);
  return Number(label.textContent?.replace(/\D/g, ''));
}

const optionFor = (key: OptionKey) =>
  within(screen.getByRole('group', { name: card.options })).getAllByRole('button')[['A', 'B', 'C'].indexOf(key)]!;
const nextButton = () => screen.queryByRole('button', { name: t.next });
const hintPanel = () => screen.queryByRole('region', { name: card.hint });

/** Answers the question on screen (wrongly) and waits for the next one; returns the new id. */
async function answerAndNext(user: ReturnType<typeof userEvent.setup>): Promise<number> {
  const id = await shownId();
  await user.click(optionFor(wrongOf(id)));
  await user.click(nextButton()!);
  return waitForChange(id);
}

async function waitForChange(from: number): Promise<number> {
  await vi.waitFor(async () => expect(await shownId()).not.toBe(from));
  return shownId();
}

describe('PracticePage', () => {
  it('keeps the Practice heading', async () => {
    renderPractice();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    await shownId();
  });

  it('opens on a question drawn by weight: its section, topic and number, stem, three options, hold and Hint', async () => {
    renderPractice();
    expect(await shownId()).toBe(1);
    const q = question(1);
    expect(screen.getByText(`${sectionOf(q)!.en} · ${topicOf(q)!.en}`)).toBeInTheDocument();
    expect(screen.getByText(q.question)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: card.options })).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: card.holdForEnglish })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: card.hint })).toBeInTheDocument();
    expect(nextButton()).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(RECENT_KEY)!)).toEqual([1]);
  });

  it('shows the English while the hold button is held and the Portuguese on release or when the pointer leaves', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    const hold = screen.getByRole('button', { name: card.holdForEnglish });
    const english = translationFor(1)!;
    await user.pointer({ keys: '[MouseLeft>]', target: hold });
    expect(screen.getByText(english.question)).toBeInTheDocument();
    expect(optionFor('A')).toHaveTextContent(english.options.A);
    await user.pointer({ keys: '[/MouseLeft]', target: hold });
    expect(screen.getByText(question(1).question)).toBeInTheDocument();

    await user.pointer({ keys: '[MouseLeft>]', target: hold });
    expect(screen.getByText(english.question)).toBeInTheDocument();
    await user.pointer({ target: document.body });
    expect(screen.getByText(question(1).question)).toBeInTheDocument();
    await user.pointer({ keys: '[/MouseLeft]', target: document.body });
    expect(screen.queryByText(english.question)).not.toBeInTheDocument();
  });

  it('records the answer, marks the chosen and correct options, locks them, and Next draws another question', async () => {
    const user = userEvent.setup();
    renderPractice();
    const q = question(await shownId());
    await user.click(optionFor(wrongOf(q.id)));
    expect(within(optionFor(wrongOf(q.id))).getByText(card.wrong)).toBeInTheDocument();
    expect(within(optionFor(q.answer)).getByText(card.correctAnswer)).toBeInTheDocument();
    for (const key of ['A', 'B', 'C'] as const) expect(optionFor(key)).toBeDisabled();
    await vi.waitFor(async () =>
      expect(await listAnswers()).toEqual([
        expect.objectContaining({ questionId: q.id, chosen: wrongOf(q.id), correct: false, mode: 'practice' }),
      ]),
    );
    await user.click(nextButton()!);
    expect(await waitForChange(q.id)).not.toBe(q.id);
    expect(nextButton()).not.toBeInTheDocument();
    for (const key of ['A', 'B', 'C'] as const) expect(optionFor(key)).toBeEnabled();
  });

  it('records a right answer as right', async () => {
    const user = userEvent.setup();
    renderPractice();
    const q = question(await shownId());
    await user.click(optionFor(q.answer));
    expect(within(optionFor(q.answer)).getByText(card.right)).toBeInTheDocument();
    await vi.waitFor(async () =>
      expect(await listAnswers()).toEqual([expect.objectContaining({ questionId: q.id, chosen: q.answer, correct: true })]),
    );
  });

  describe('the hint panel (D23)', () => {
    const hint = hintFor(1)!;

    it('shows only the language notes before answering, keeps them open with the nudge added, and closes on Next', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      expect(hintPanel()).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: card.hint }));
      expect(within(hintPanel()!).getByText(hint.language[0]!.note)).toBeInTheDocument();
      expect(screen.queryByText(hint.nudge)).not.toBeInTheDocument();

      await user.click(optionFor('A'));
      expect(within(hintPanel()!).getByText(hint.nudge)).toBeInTheDocument();
      expect(within(hintPanel()!).getByText(hint.language[0]!.note)).toBeInTheDocument();

      await user.click(nextButton()!);
      await waitForChange(1);
      expect(hintPanel()).not.toBeInTheDocument();
    });

    it('stays closed when answering with it closed; a later Hint tap shows notes and nudge', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      await user.click(optionFor('A'));
      expect(hintPanel()).not.toBeInTheDocument();
      expect(screen.queryByText(hint.nudge)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: card.hint }));
      expect(within(hintPanel()!).getByText(hint.language[0]!.note)).toBeInTheDocument();
      expect(within(hintPanel()!).getByText(hint.nudge)).toBeInTheDocument();
    });
  });

  describe('the recent window (D4, D5)', () => {
    it('shows eleven distinct questions in eleven draws over the whole bank, then lets the eleventh-last back', async () => {
      const user = userEvent.setup();
      renderPractice();
      const ids = [await shownId()];
      for (let i = 0; i < RECENT_LIMIT; i++) ids.push(await answerAndNext(user));
      expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(new Set(ids).size).toBe(11);
      // Without the window a source of 0 would draw question 1 every time; with it, 1 is back only once it has left.
      expect(await answerAndNext(user)).toBe(1);
    });

    it('keeps the window across a reload in the same tab', async () => {
      const user = userEvent.setup();
      const firstVisit = renderPractice();
      const ids = [await shownId()];
      for (let i = 0; i < 5; i++) ids.push(await answerAndNext(user));
      firstVisit.unmount();
      await closeStorage();

      renderPractice();
      ids.push(await shownId());
      for (let i = 0; i < 4; i++) ids.push(await answerAndNext(user));
      expect(ids).toHaveLength(11);
      expect(new Set(ids).size).toBe(11);
      expect(JSON.parse(sessionStorage.getItem(RECENT_KEY)!)).toEqual(ids.slice(-RECENT_LIMIT));
    });

    it('reads a garbled window as empty', async () => {
      sessionStorage.setItem(RECENT_KEY, '{not json');
      renderPractice();
      expect(await shownId()).toBe(1);
      expect(JSON.parse(sessionStorage.getItem(RECENT_KEY)!)).toEqual([1]);
    });
  });

  describe('the laptop keys (D9)', () => {
    it('answers with A, B, C and 1, 2, 3 only while unanswered, and advances with Enter only once answered', async () => {
      const user = userEvent.setup();
      renderPractice();
      expect(await shownId()).toBe(1);
      await user.keyboard('{Enter}');
      expect(await shownId()).toBe(1);

      await user.keyboard('b');
      expect(optionFor('B')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('c3');
      expect(optionFor('C')).toHaveAttribute('aria-pressed', 'false');
      await vi.waitFor(async () => expect(await listAnswers()).toHaveLength(1));

      await user.keyboard('{Enter}');
      expect(await waitForChange(1)).toBe(2);
      await user.keyboard('3');
      expect(optionFor('C')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{Enter}');
      expect(await waitForChange(2)).toBe(3);
      await user.keyboard('A');
      expect(optionFor('A')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{Enter}');
      expect(await waitForChange(3)).toBe(4);
      await user.keyboard('1');
      expect(optionFor('A')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{Enter}');
      expect(await waitForChange(4)).toBe(5);
      await user.keyboard('2');
      expect(optionFor('B')).toHaveAttribute('aria-pressed', 'true');

      await vi.waitFor(async () =>
        expect((await listAnswers()).map((a) => [a.questionId, a.chosen])).toEqual([
          [1, 'B'],
          [2, 'C'],
          [3, 'A'],
          [4, 'A'],
          [5, 'B'],
        ]),
      );
    });

    it('peeks while Space is held, ignores repeats and clears on keyup and when the window loses focus', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      const english = translationFor(1)!.question;
      const portuguese = question(1).question;

      const down = fireEvent.keyDown(window, { key: ' ', code: 'Space' });
      expect(down).toBe(false);
      expect(screen.getByText(english)).toBeInTheDocument();
      fireEvent.keyDown(window, { key: ' ', code: 'Space', repeat: true });
      expect(screen.getByText(english)).toBeInTheDocument();
      fireEvent.keyUp(window, { key: ' ', code: 'Space' });
      expect(screen.getByText(portuguese)).toBeInTheDocument();

      await user.keyboard('[Space>]');
      expect(screen.getByText(english)).toBeInTheDocument();
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });
      expect(screen.getByText(portuguese)).toBeInTheDocument();
      await user.keyboard('[/Space]');
      expect(screen.getByText(portuguese)).toBeInTheDocument();
    });

    it('does not answer from Space on a focused option', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      optionFor('A').focus();
      await user.keyboard(' ');
      expect(optionFor('A')).toHaveAttribute('aria-pressed', 'false');
      expect(nextButton()).not.toBeInTheDocument();
    });

    it('leaves Enter and Space on a link outside the page, such as the back control, alone', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      await user.keyboard('a');
      expect(nextButton()).toBeInTheDocument();
      const back = document.createElement('a');
      back.href = '#home';
      back.textContent = 'Home';
      document.body.prepend(back);
      back.focus();
      const enter = fireEvent.keyDown(back, { key: 'Enter', code: 'Enter' });
      expect(enter).toBe(true);
      const space = fireEvent.keyDown(back, { key: ' ', code: 'Space' });
      expect(space).toBe(true);
      expect(screen.getByText(question(1).question)).toBeInTheDocument();
      expect(await shownId()).toBe(1);
      back.remove();
    });

    it('opens Hint from the keyboard after answering: Enter on the focused Hint button does not advance', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      await user.keyboard('a');
      screen.getByRole('button', { name: card.hint }).focus();
      await user.keyboard('{Enter}');
      expect(hintPanel()).toBeInTheDocument();
      expect(await shownId()).toBe(1);
    });

    it('ignores the keys while typing in a text field', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      const field = document.createElement('input');
      document.body.append(field);
      field.focus();
      await user.keyboard('a1 ');
      expect(field).toHaveValue('a1 ');
      expect(screen.getByText(question(1).question)).toBeInTheDocument();
      expect(nextButton()).not.toBeInTheDocument();
      field.remove();
    });
  });
});
