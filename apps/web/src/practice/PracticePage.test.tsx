import { hintFor, sectionOf, topicOf, translationFor, type OptionKey, type Question } from '@cacador/data';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { bankPool, RECENT_LIMIT } from '@/model';
import { closeStorage, getStates, listAnswers, RECENT_KEY } from '@/storage';
import { PracticePage } from './PracticePage';
import { PracticeSession } from './PracticeSession';
import { correctOf, question, wrongOf } from '../../test/fixtures';
import { failStore } from '../../test/storage';

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

/** A bare header for PracticeSession on its own: the question's number, which shownId reads. */
const numberHeader = (q: Question | undefined) => q && <p>{card.questionNumber(q.id)}</p>;

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

/** The recent window as stored. */
const storedRecent = (): unknown => JSON.parse(sessionStorage.getItem(RECENT_KEY)!);

/** Lets a draw already under way finish: its storage read and the draw after it. */
async function settle(): Promise<void> {
  await getStates();
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/** Answers question 1 wrongly, waits for the answer to be stored, then taps Next in the same tick as the caller's next step. */
async function answerThenTapNext(): Promise<void> {
  fireEvent.click(optionFor(wrongOf(1)));
  await vi.waitFor(async () => expect(await listAnswers()).toHaveLength(1));
  fireEvent.click(nextButton()!);
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

  it('names the question in the screen header: the section · topic eyebrow over "Question N", outside the card', async () => {
    renderPractice();
    expect(await shownId()).toBe(1);
    const q = question(1);
    const article = screen.getByRole('article');
    const place = screen.getByText(`${sectionOf(q)!.en} · ${topicOf(q)!.en}`);
    const number = screen.getByText(card.questionNumber(1));
    expect(place).toHaveClass('eyebrow');
    expect(number).toHaveClass('font-heading');
    expect(article).not.toContainElement(place);
    expect(article).not.toContainElement(number);
    expect(screen.getByRole('link', { name: MESSAGES.en.common.backToHome })).toBeInTheDocument();
  });

  it('shows the header with the screen name before a question is drawn', async () => {
    renderPractice();
    expect(screen.getByRole('status')).toHaveTextContent(t.loading);
    expect(screen.getByText(MESSAGES.en.common.nav.practice, { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: MESSAGES.en.common.backToHome })).toBeInTheDocument();
    await shownId();
  });

  it('reads Report: before the two flag chips, and puts the rust Next under them', async () => {
    const user = userEvent.setup();
    renderPractice();
    await user.click(optionFor(wrongOf(await shownId())));
    const flags = screen.getByRole('group', { name: t.flags.group });
    const report = within(flags).getByText(t.flags.report);
    const chips = [t.flags.englishOff, t.flags.hintOff].map((name) => within(flags).getByRole('button', { name }));
    for (const chip of chips) {
      expect(report.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(chip).toHaveClass('h-9');
      expect(chip.querySelector('svg.lucide-flag')).toBeInTheDocument();
    }
    const next = nextButton()!;
    expect(next).toHaveClass('bg-primary');
    expect(flags.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has the Report: word in Portuguese too', () => {
    expect(MESSAGES.pt.practice.flags.report).toBe('Assinalar:');
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

  it('says when an answer could not be saved, keeps the result, and Next still draws (cac-eil.25)', async () => {
    const user = userEvent.setup();
    renderPractice();
    const id = await shownId();
    const add = failStore('add');
    await user.click(optionFor(wrongOf(id)));
    expect(within(optionFor(wrongOf(id))).getByText(card.wrong)).toBeInTheDocument();
    expect(await screen.findByText(t.answerNotSaved)).toBeInTheDocument();
    expect(add).toHaveBeenCalled();
    expect(await listAnswers()).toEqual([]);
    add.mockRestore();

    await user.click(nextButton()!);
    expect(await waitForChange(id)).toBe(2);
    expect(screen.queryByText(t.answerNotSaved)).not.toBeInTheDocument();
  });

  describe('storage that cannot be read (DESIGN.md § 6.9)', () => {
    it('says so under the header with the back control, and draws nothing', async () => {
      failStore('getAll', { store: 'questionState' });
      renderPractice();
      const status = await screen.findByText(t.loadFailed);
      expect(status).toHaveAttribute('role', 'status');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
      const back = screen.getByRole('link', { name: MESSAGES.en.common.backToHome });
      expect(back.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByText(t.loading)).not.toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(sessionStorage.getItem(RECENT_KEY)).toBeNull();
    });

    it('shows the question a new pool draws after the old pool could not be read (cac-8cn.18)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      failStore('getAll', { store: 'questionState', times: 1 });
      const view = render(<PracticeSession pool={[413, 414, 415]} header={numberHeader} />);
      expect(await screen.findByText(t.loadFailed)).toBeInTheDocument();
      view.rerender(<PracticeSession pool={bankPool} header={numberHeader} />);
      expect(await shownId()).toBe(1);
      expect(screen.queryByText(t.loadFailed)).not.toBeInTheDocument();
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });

  describe('a Next under way when the page changes (cac-eil.38)', () => {
    it('draws nothing once the page has gone', async () => {
      const view = renderPractice();
      expect(await shownId()).toBe(1);
      await answerThenTapNext();
      view.unmount();
      await settle();
      expect(storedRecent()).toEqual([1]);
    });

    it('draws nothing from the old pool once the pool has changed', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const view = render(<PracticeSession pool={bankPool} header={numberHeader} />);
      expect(await shownId()).toBe(1);
      await answerThenTapNext();
      view.rerender(<PracticeSession pool={[413, 414, 415]} header={numberHeader} />);
      expect(await waitForChange(1)).toBe(413);
      await settle();
      expect(await shownId()).toBe(413);
      expect(storedRecent()).toEqual([1, 413]);
    });
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

    it('leaves Enter and Space on the screen header\'s back control alone: it sits outside the keys\' region', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      await user.keyboard('a');
      expect(nextButton()).toBeInTheDocument();
      const back = screen.getByRole('link', { name: MESSAGES.en.common.backToHome });
      back.focus();
      const enter = fireEvent.keyDown(back, { key: 'Enter', code: 'Enter' });
      expect(enter).toBe(true);
      const space = fireEvent.keyDown(back, { key: ' ', code: 'Space' });
      expect(space).toBe(true);
      expect(screen.getByText(question(1).question)).toBeInTheDocument();
      expect(await shownId()).toBe(1);
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

    it('advances with Enter after the hold button was pressed with the mouse: the hold button takes no focus (cac-eil.33)', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      await user.keyboard('a');
      const hold = screen.getByRole('button', { name: card.holdForEnglish });
      await user.pointer({ keys: '[MouseLeft]', target: hold });
      expect(hold).not.toHaveFocus();
      await user.keyboard('{Enter}');
      expect(await waitForChange(1)).toBe(2);
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

  describe('a round (cac-zdk)', () => {
    const ROUND = 3;
    /** The counter in the screen header's right-hand slot, or null without a round. */
    const counter = () => within(document.querySelector('header')!).queryByText(/^\d+ of \d+$/);
    const finishButton = () => screen.queryByRole('button', { name: t.round.finish });
    const scorePlate = () => screen.queryByRole('region', { name: t.round.done });

    /** Practice at `?round=3`, beside a link to plain /practice standing in for the Practice tab. */
    function renderRound() {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      return render(
        <MemoryRouter initialEntries={[`/practice?round=${ROUND}`]}>
          <Routes>
            <Route path="practice" element={<PracticePage />} />
          </Routes>
          <Link to="/practice">tab</Link>
        </MemoryRouter>,
      );
    }

    it('counts the question on screen in the header, in Fraunces, and the counter stays on the answer', async () => {
      const user = userEvent.setup();
      renderRound();
      expect(await shownId()).toBe(1);
      expect(counter()).toHaveTextContent(t.round.position(1, ROUND));
      expect(counter()).toHaveClass('font-heading');
      await user.click(optionFor(wrongOf(1)));
      expect(counter()).toHaveTextContent(t.round.position(1, ROUND));
      expect(nextButton()).toBeInTheDocument();
      expect(finishButton()).not.toBeInTheDocument();
      await user.click(nextButton()!);
      expect(await waitForChange(1)).toBe(2);
      expect(counter()).toHaveTextContent(t.round.position(2, ROUND));
    });

    it('shows no counter and no Finish without the query', async () => {
      const user = userEvent.setup();
      renderPractice();
      await shownId();
      expect(counter()).toBeNull();
      await user.click(optionFor(wrongOf(1)));
      expect(nextButton()).toBeInTheDocument();
      expect(finishButton()).not.toBeInTheDocument();
    });

    it('ends on the last answer: Finish in place of Next, the count right on the plate, no card, and Another starts a new round', async () => {
      const user = userEvent.setup();
      renderRound();
      expect(await shownId()).toBe(1);
      await user.click(optionFor(wrongOf(1)));
      await user.click(nextButton()!);
      expect(await waitForChange(1)).toBe(2);
      await user.click(optionFor(correctOf(2)));
      await user.click(nextButton()!);
      expect(await waitForChange(2)).toBe(3);
      await user.click(optionFor(correctOf(3)));
      expect(counter()).toHaveTextContent(t.round.position(3, ROUND));
      expect(nextButton()).not.toBeInTheDocument();
      const finish = finishButton()!;
      expect(finish).toHaveClass('bg-primary');
      // The flags row still sits under the last answer.
      expect(screen.getByRole('group', { name: t.flags.group })).toBeInTheDocument();

      await user.click(finish);
      const plate = scorePlate()!;
      expect(plate).toHaveClass('bg-card');
      expect(within(plate).getByText('2')).toHaveClass('font-heading');
      expect(within(plate).getByText(t.round.ofRight(ROUND))).toBeInTheDocument();
      expect(counter()).toHaveTextContent(t.round.position(ROUND, ROUND));
      expect(screen.getByText(MESSAGES.en.common.nav.practice, { selector: 'p.eyebrow' })).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: card.holdForEnglish })).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // The option keys answer nothing on the score.
      await user.keyboard('a');
      expect(await listAnswers()).toHaveLength(3);

      const another = within(plate).getByRole('button', { name: t.round.another(ROUND) });
      expect(another).toHaveClass('bg-primary');
      await user.click(another);
      expect(await shownId()).toBe(4);
      expect(scorePlate()).not.toBeInTheDocument();
      // The focus is on the new round's region, as on the words drill, not dropped to the body with the score plate.
      expect(screen.getByRole('article').parentElement).toHaveFocus();
      expect(counter()).toHaveTextContent(t.round.position(1, ROUND));
      await user.click(optionFor(wrongOf(4)));
      expect(nextButton()).toBeInTheDocument();
      expect(finishButton()).not.toBeInTheDocument();
    });

    it('finishes with Enter on the last answer, as Next does before it', async () => {
      const user = userEvent.setup();
      renderRound();
      expect(await shownId()).toBe(1);
      for (let n = 1; n < ROUND; n++) {
        await user.keyboard('1');
        await user.keyboard('{Enter}');
        expect(await waitForChange(n)).toBe(n + 1);
      }
      await user.keyboard('1');
      expect(finishButton()).toBeInTheDocument();
      await user.keyboard('{Enter}');
      expect(scorePlate()).toBeInTheDocument();
    });

    it('ends the round when the query goes: the Practice tab shows endless practice afresh', async () => {
      const user = userEvent.setup();
      renderRound();
      expect(await shownId()).toBe(1);
      await user.click(optionFor(wrongOf(1)));
      await user.click(screen.getByRole('link', { name: 'tab' }));
      expect(await waitForChange(1)).toBe(2);
      expect(counter()).toBeNull();
      expect(nextButton()).not.toBeInTheDocument();
      await user.click(optionFor(wrongOf(2)));
      expect(nextButton()).toBeInTheDocument();
      expect(finishButton()).not.toBeInTheDocument();
    });

    it('has the round words in Portuguese too', () => {
      const pt = MESSAGES.pt.practice.round;
      expect(pt.position(3, 10)).toBe('3 de 10');
      expect(pt.finish).toBe('Terminar');
      expect(pt.done).toBe('Ronda terminada');
      expect(pt.ofRight(10)).toBe('de 10 certas');
      expect(pt.another(10)).toBe('Mais 10');
      expect(MESSAGES.pt.home.roundTitle(10)).toBe('Ronda de 10');
    });
  });
});
