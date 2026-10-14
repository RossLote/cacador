import { hintFor, translationFor, type OptionKey } from '@cacador/data';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openDB } from 'idb';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n/locale';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, seededRandom } from '@/model';
import { createExam, finishExam, getExam, saveExamAnswer, type Exam } from '@/storage';
import { DB_NAME, DB_VERSION } from '@/storage/idbBackend';
import { ExamPage } from './ExamPage';
import { question, wrongOf } from '../../test/fixtures';
import { answerExam } from '../../test/storage';

const t = MESSAGES.en.exam;
const card = MESSAGES.en.practice.card;
const examIds = drawExam(seededRandom(11));
const OPTIONS: readonly OptionKey[] = ['A', 'B', 'C'];

/**
 * A finished exam over `examIds`: the first `right` answered right, the last
 * `unanswered` left alone, and the rest answered wrong.
 */
async function finishedExam(right: number, unanswered = 0) {
  const exam = await createExam(examIds);
  const answers: Record<number, OptionKey> = {};
  examIds.slice(0, examIds.length - unanswered).forEach((id, index) => {
    const q = question(id);
    answers[id] = index < right ? q.answer : wrongOf(q.id);
  });
  await answerExam(exam.id, answers);
  expect(await finishExam(exam.id)).toBe(true);
  return { id: exam.id, answers };
}

function renderResults(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/exam/results/${id}`]}>
      <Routes>
        <Route path="exam/*" element={<ExamPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const wrongList = () => screen.findByRole('list', { name: t.wrongAnswers });
const optionsIn = (item: HTMLElement) => within(within(item).getByRole('group', { name: card.options })).getAllByRole('button');
/** The bank id on an item's card, from its "Question <id>". */
const idIn = (item: HTMLElement) => Number(within(item).getByText(/^Question \d+$/).textContent?.replace(/\D/g, ''));

describe('the results of a finished exam', () => {
  it('shows 14 out of 20 against 15, Not passed, and exactly the six wrong ones, the unanswered one with only the correct option', async () => {
    const { id, answers } = await finishedExam(14, 1);
    expect((await getExam(id))?.score).toBe(14);
    renderResults(id);

    const items = within(await wrongList()).getAllByRole('listitem');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.resultsTitle);
    expect(screen.getByText('14 out of 20')).toHaveClass('font-heading');
    expect(screen.getByText('Pass mark 15')).toBeInTheDocument();
    // The Not passed chip: the destructive badge, clay with ink text and a rust hairline (DESIGN.md § 8.5).
    expect(screen.getByText('Not passed')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByText('Not passed')).toHaveClass('bg-clay', 'text-ink', 'border-destructive');
    expect(screen.queryByText('Passed')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: t.wrongAnswers })).toBeInTheDocument();

    expect(items.map(idIn)).toEqual(examIds.slice(14));
    for (const item of items) {
      const q = question(idIn(item));
      const chosen = answers[q.id];
      const options = optionsIn(item);
      expect(options.every((o) => o.hasAttribute('disabled'))).toBe(true);
      const marks = options.map((o) => o.getAttribute('data-mark'));
      expect(marks[OPTIONS.indexOf(q.answer)]).toBe('correct');
      if (chosen === undefined) {
        expect(marks.filter(Boolean)).toEqual(['correct']);
        expect(within(item).getByText(t.notAnswered)).toBeInTheDocument();
        expect(within(item).queryByText(card.wrong)).not.toBeInTheDocument();
      } else {
        expect(marks[OPTIONS.indexOf(chosen)]).toBe('wrong');
        expect(options[OPTIONS.indexOf(chosen)]).toHaveAttribute('aria-pressed', 'true');
        expect(within(item).queryByText(t.notAnswered)).not.toBeInTheDocument();
      }
      expect(within(item).getByText(card.correctAnswer)).toBeInTheDocument();
      expect(within(item).getByRole('button', { name: card.hint })).toBeEnabled();
      expect(within(item).getByRole('button', { name: card.holdForEnglish })).toBeEnabled();
      // Three options, the peek and Hint: nothing else, so no flags row.
      expect(within(item).getAllByRole('button')).toHaveLength(5);
    }
    expect(items.filter((item) => within(item).queryByText(t.notAnswered))).toHaveLength(1);
    const flags = MESSAGES.en.practice.flags;
    expect(screen.queryByRole('button', { name: flags.englishOff })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: flags.hintOff })).not.toBeInTheDocument();
    // Six cards queried by role one by one: past the 5 s default on a loaded machine.
  }, 15_000);

  it('shows Passed at 15 out of 20 with the five wrong ones', async () => {
    const { id } = await finishedExam(15);
    renderResults(id);
    const items = within(await wrongList()).getAllByRole('listitem');
    expect(screen.getByText('15 out of 20')).toBeInTheDocument();
    // The Passed chip: the success badge, moss with forest text.
    expect(screen.getByText('Passed')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByText('Passed')).toHaveClass('bg-accent', 'text-success');
    expect(screen.queryByText('Not passed')).not.toBeInTheDocument();
    expect(items.map(idIn)).toEqual(examIds.slice(15));
  });

  it('says there are no wrong answers at 20 out of 20', async () => {
    const { id } = await finishedExam(20);
    renderResults(id);
    expect(await screen.findByText(t.noWrongAnswers)).toBeInTheDocument();
    expect(screen.getByText('20 out of 20')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: t.wrongAnswers })).not.toBeInTheDocument();
  });

  it('shows the score its answers earn, not a stored score that disagrees with them, so it matches the wrong ones', async () => {
    const { id } = await finishedExam(14, 1);
    // A stored score that no longer matches the answers (an earlier answer key, an old import).
    const db = await openDB(DB_NAME, DB_VERSION);
    const record = (await db.get('exams', id)) as Exam;
    await db.put('exams', { ...record, score: 20 });
    db.close();
    expect((await getExam(id))?.score).toBe(20);

    renderResults(id);
    const items = within(await wrongList()).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(screen.getByText('14 out of 20')).toBeInTheDocument();
    expect(screen.getByText('Not passed')).toBeInTheDocument();
    expect(screen.queryByText('20 out of 20')).not.toBeInTheDocument();
  });

  it('peeks one card at a time while its button is held, and opens its own hint, with no keys', async () => {
    const { id } = await finishedExam(14, 1);
    renderResults(id);
    const [first, second] = within(await wrongList()).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    const q1 = question(idIn(first));
    const q2 = question(idIn(second));
    const english1 = translationFor(q1.id)!.question;
    const hold = within(first).getByRole('button', { name: card.holdForEnglish });

    fireEvent.pointerDown(hold, { pointerType: 'touch' });
    expect(within(first).getByText(english1)).toBeInTheDocument();
    expect(within(first).queryByText(q1.question)).not.toBeInTheDocument();
    expect(within(second).getByText(q2.question)).toBeInTheDocument();
    fireEvent.pointerUp(hold, { pointerType: 'touch' });
    expect(within(first).getByText(q1.question)).toBeInTheDocument();
    expect(within(first).queryByText(english1)).not.toBeInTheDocument();

    // Space is not bound here: no English anywhere.
    const user = userEvent.setup();
    await user.keyboard('[Space>]');
    expect(screen.queryByText(english1)).not.toBeInTheDocument();
    await user.keyboard('[/Space]');

    const hint = within(second).getByRole('button', { name: card.hint });
    expect(hint).toHaveAttribute('aria-expanded', 'false');
    await user.click(hint);
    expect(hint).toHaveAttribute('aria-expanded', 'true');
    expect(within(second).getByRole('region', { name: card.hint })).toBeInTheDocument();
    expect(within(first).queryByRole('region', { name: card.hint })).not.toBeInTheDocument();
    const nudge = hintFor(q2.id)?.nudge;
    if (nudge) expect(within(second).getByText(nudge)).toBeInTheDocument();
  });

  it('shows the results in European Portuguese', async () => {
    const { id } = await finishedExam(14, 1);
    act(() => setLocale('pt'));
    renderResults(id);
    const pt = MESSAGES.pt.exam;
    expect(await screen.findByRole('list', { name: pt.wrongAnswers })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(pt.resultsTitle);
    expect(screen.getByText('14 em 20')).toBeInTheDocument();
    expect(screen.getByText(pt.notPassed)).toBeInTheDocument();
  });
});

describe('an id that is not a finished exam', () => {
  it('says so for an unknown id, under the Exam heading, with a link to the exam', async () => {
    renderResults('abc');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(screen.getByRole('link', { name: t.toExam })).toHaveAttribute('href', '/exam');
    expect(screen.queryByText(/out of 20/)).not.toBeInTheDocument();
  });

  it('says so for an exam still running', async () => {
    const exam = await createExam(examIds);
    await saveExamAnswer(exam.id, examIds[0]!, 'A');
    renderResults(exam.id);
    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: t.wrongAnswers })).not.toBeInTheDocument();
    expect((await getExam(exam.id))?.finishedAt).toBeUndefined();
  });
});

describe('results messages', () => {
  it('words the strings the e2e suite reads', () => {
    expect([
      t.resultsTitle,
      t.score(14, 20),
      t.passMark(15),
      t.passed,
      t.notPassed,
      t.wrongAnswers,
      t.noWrongAnswers,
      t.notAnswered,
      t.notFound,
      t.toExam,
    ]).toEqual([
      'Exam results',
      '14 out of 20',
      'Pass mark 15',
      'Passed',
      'Not passed',
      'Wrong answers',
      'No wrong answers',
      'Not answered',
      'There is no finished exam here.',
      'Go to the exam',
    ]);
  });
});
