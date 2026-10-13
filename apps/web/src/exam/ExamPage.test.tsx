import 'fake-indexeddb/auto';
import { questionById, translationFor, type OptionKey, type Question } from '@cacador/data';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, examDeadline, scoreExam, seededRandom } from '@/model';
import { closeStorage, createExam, finishExam, getExam, listAnswers, listExams, saveExamAnswers, type Exam } from '@/storage';
import { ExamPage } from './ExamPage';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = Date.UTC(2026, 9, 13, 9, 0);
const t = MESSAGES.en.exam;
const card = MESSAGES.en.practice.card;
const SEED = 7;
/** The questions Start draws with the seeded source the tests pass. */
const examIds = drawExam(seededRandom(SEED));

function question(id: number): Question {
  const q = questionById(id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
}
const wrongOf = (q: Question): OptionKey => (q.answer === 'A' ? 'B' : 'A');

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderExam(path = '/exam') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="exam/*" element={<ExamPage random={seededRandom(SEED)} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const startButton = () => screen.findByRole('button', { name: t.start });
const clock = () => screen.getByRole('timer', { name: t.timeLeft });
const marker = (n: number) => screen.getByRole('button', { name: t.marker(n) });
const optionFor = (key: OptionKey) =>
  within(screen.getByRole('group', { name: card.options })).getAllByRole('button')[['A', 'B', 'C'].indexOf(key)]!;
/** The bank id of the question on screen, from the card's "Question <id>". */
const shownId = () => Number(screen.getByText(/^Question \d+$/, { selector: 'p' }).textContent?.replace(/\D/g, ''));

/** Starts an exam and waits for its first question. */
async function start(user: ReturnType<typeof userEvent.setup>) {
  renderExam();
  await user.click(await startButton());
  await screen.findByText(t.position(1, 20));
}

async function stored(): Promise<Exam> {
  const [exam] = await listExams();
  if (!exam) throw new Error('no exam stored');
  return exam;
}

beforeEach(async () => {
  await closeStorage();
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(async () => {
  vi.useRealTimers();
  await closeStorage();
  vi.unstubAllGlobals();
});

describe('the exam start screen', () => {
  it('shows the heading, the rules and Start when no exam is running', async () => {
    renderExam();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(await startButton()).toBeEnabled();
    expect(screen.getByText(t.intro(20, 30, 15))).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('shows Start, and logs nothing more, when the only exam started more than 30 minutes ago', async () => {
    const startedAt = Date.now() - 31 * MINUTE;
    const exam = await createExam(examIds, startedAt);
    await saveExamAnswers(exam.id, { [examIds[0]!]: 'A' }, startedAt + MINUTE);

    const first = renderExam();
    expect(await startButton()).toBeInTheDocument();
    const settled = await getExam(exam.id);
    expect(settled?.finishedAt).toBe(examDeadline(exam));
    expect(await listAnswers()).toHaveLength(20);
    first.unmount();

    renderExam();
    expect(await startButton()).toBeInTheDocument();
    expect(await listAnswers()).toHaveLength(20);
    expect(await getExam(exam.id)).toEqual(settled);
  });
});

describe('the running exam', () => {
  it('starts on 1 of 20 with a clock from 30:00, 20 markers, the card with no peek, no Hint and no flags row', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const user = userEvent.setup();
    await start(user);

    const exam = await stored();
    expect(exam.questionIds).toEqual(examIds);
    expect(exam.startedAt).toBe(T0);
    expect(exam.finishedAt).toBeUndefined();
    expect(shownId()).toBe(examIds[0]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(screen.getByText('1 of 20')).toBeInTheDocument();
    expect(clock()).toHaveTextContent('30:00');

    const strip = screen.getByRole('navigation', { name: t.markers });
    const markers = within(strip).getAllByRole('button');
    expect(markers.map((m) => m.textContent)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
    expect(marker(1)).toHaveAttribute('aria-current', 'step');
    expect(markers.filter((m) => m.hasAttribute('aria-current'))).toHaveLength(1);
    expect(markers.every((m) => m.dataset.answered === 'false')).toBe(true);

    expect(screen.queryByRole('button', { name: card.holdForEnglish })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: card.hint })).not.toBeInTheDocument();
    // 20 markers, 3 options, Previous, Next and Submit: nothing else, so no flags row.
    expect(screen.getAllByRole('button')).toHaveLength(26);
    expect(screen.getByRole('button', { name: t.previous })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled();
  });

  it('leaves Space unbound: no English, nothing selected', async () => {
    const user = userEvent.setup();
    await start(user);
    const english = translationFor(examIds[0]!)!.question;
    const down = fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(down).toBe(true);
    await user.keyboard('[Space>]a1');
    expect(screen.queryByText(english)).not.toBeInTheDocument();
    expect(screen.getByText(question(examIds[0]!).question)).toBeInTheDocument();
    for (const key of ['A', 'B', 'C'] as const) expect(optionFor(key)).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard('[/Space]');
    expect(screen.getByText('1 of 20')).toBeInTheDocument();
  });

  it('shows a tapped option as selected with nothing marked, lets it change, and saves each change', async () => {
    const user = userEvent.setup();
    await start(user);
    const q = question(examIds[0]!);

    await user.click(optionFor(wrongOf(q)));
    expect(optionFor(wrongOf(q))).toHaveAttribute('aria-pressed', 'true');
    for (const key of ['A', 'B', 'C'] as const) {
      expect(optionFor(key)).toBeEnabled();
      expect(optionFor(key)).not.toHaveAttribute('data-mark');
    }
    for (const word of [card.right, card.wrong, card.correctAnswer]) expect(screen.queryByText(word)).not.toBeInTheDocument();
    expect(marker(1)).toHaveAttribute('data-answered', 'true');
    expect(marker(1)).toHaveAccessibleDescription(t.answered);
    await waitFor(async () => expect((await stored()).answers).toEqual({ [q.id]: wrongOf(q) }));

    await user.click(optionFor(q.answer));
    expect(optionFor(q.answer)).toHaveAttribute('aria-pressed', 'true');
    expect(optionFor(wrongOf(q))).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(card.right)).not.toBeInTheDocument();
    await waitFor(async () => expect((await stored()).answers).toEqual({ [q.id]: q.answer }));
    expect(await listAnswers()).toEqual([]);
  });

  it('moves with Previous, Next and the markers, keeping each answer', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getByRole('button', { name: t.next }));
    expect(screen.getByText('2 of 20')).toBeInTheDocument();
    expect(shownId()).toBe(examIds[1]);
    expect(marker(2)).toHaveAttribute('aria-current', 'step');
    await user.click(optionFor('C'));

    await user.click(marker(20));
    expect(screen.getByText('20 of 20')).toBeInTheDocument();
    expect(shownId()).toBe(examIds[19]);
    expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
    expect(optionFor('C')).toHaveAttribute('aria-pressed', 'false');

    await user.click(marker(2));
    expect(optionFor('C')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: t.previous }));
    expect(screen.getByText('1 of 20')).toBeInTheDocument();
    expect(marker(1)).toHaveAttribute('data-answered', 'false');
    expect(marker(2)).toHaveAttribute('data-answered', 'true');
  });

  it('keeps three answers across a new page load, with the clock moved on by the time away', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const user = userEvent.setup();
    const firstLoad = renderExam();
    await user.click(await startButton());
    await screen.findByText('1 of 20');
    const chosen: OptionKey[] = ['B', 'C', 'A'];
    for (const option of chosen) {
      await user.click(optionFor(option));
      await user.click(screen.getByRole('button', { name: t.next }));
    }
    await waitFor(async () => expect(Object.keys((await stored()).answers)).toHaveLength(3));
    firstLoad.unmount();
    await closeStorage();

    vi.setSystemTime(T0 + 7 * MINUTE + 30 * SECOND);
    renderExam();
    // Resumed on the first unanswered question, its answers kept and the clock 7:30 down.
    expect(await screen.findByText('4 of 20')).toBeInTheDocument();
    expect(clock()).toHaveTextContent('22:30');
    expect(screen.queryByRole('button', { name: t.start })).not.toBeInTheDocument();
    for (const [index, option] of chosen.entries()) {
      expect(marker(index + 1)).toHaveAttribute('data-answered', 'true');
      await user.click(marker(index + 1));
      expect(optionFor(option)).toHaveAttribute('aria-pressed', 'true');
    }
    expect(marker(4)).toHaveAttribute('data-answered', 'false');
  });

  it('counts down each second while open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    vi.setSystemTime(T0);
    await createExam(examIds, T0 - 10 * MINUTE);
    renderExam();
    await screen.findByText('1 of 20');
    expect(clock()).toHaveTextContent('20:00');
    await act(() => vi.advanceTimersByTimeAsync(SECOND));
    expect(clock()).toHaveTextContent('19:59');
    // One tick at a time: each re-render arms the next second's timer.
    for (let i = 0; i < 61; i++) await act(() => vi.advanceTimersByTimeAsync(SECOND));
    expect(clock()).toHaveTextContent('18:58');
  });
});

describe('submitting', () => {
  it('submits all 20 straight away, with the changed answer stored, the score set, 20 exam answers logged, and opens the results', async () => {
    const user = userEvent.setup();
    await start(user);
    for (let n = 1; n <= 20; n++) {
      const q = question(shownId());
      await user.click(optionFor(n % 2 === 0 ? q.answer : wrongOf(q)));
      if (n < 20) await user.click(screen.getByRole('button', { name: t.next }));
    }
    // Back to question 5 by its marker, and change it to the right answer.
    await user.click(marker(5));
    const fifth = question(examIds[4]!);
    await user.click(optionFor(fifth.answer));

    await user.click(screen.getByRole('button', { name: t.submit }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(where()).toMatch(/^\/exam\/results\//));
    const exam = await stored();
    expect(where()).toBe(`/exam/results/${exam.id}`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);

    expect(Object.keys(exam.answers)).toHaveLength(20);
    expect(exam.answers[fifth.id]).toBe(fifth.answer);
    expect(exam.finishedAt).toBeTypeOf('number');
    expect(exam.score).toBe(scoreExam(exam));
    expect(exam.score).toBe(11);

    const log = await listAnswers();
    expect(log).toHaveLength(20);
    expect(log.every((a) => a.mode === 'exam' && a.examId === exam.id)).toBe(true);
    expect(log.find((a) => a.questionId === fifth.id)).toMatchObject({ chosen: fifth.answer, correct: true });
  });

  it('asks first when questions are unanswered, stays on Back to the exam, and logs the unanswered ones as wrong with no option', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(optionFor('A'));
    await user.click(marker(7));
    await user.click(optionFor('B'));

    await user.click(screen.getByRole('button', { name: t.submit }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('18 unanswered — submit anyway?');
    await user.click(within(dialog).getByRole('button', { name: t.keepGoing }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(where()).toBe('/exam');
    expect((await stored()).finishedAt).toBeUndefined();

    await user.click(screen.getByRole('button', { name: t.submit }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit }));
    await waitFor(() => expect(where()).toMatch(/^\/exam\/results\//));

    const exam = await stored();
    expect(exam.finishedAt).toBeTypeOf('number');
    const log = await listAnswers();
    expect(log).toHaveLength(20);
    const unanswered = log.filter((a) => a.chosen === undefined);
    expect(unanswered).toHaveLength(18);
    expect(unanswered.every((a) => !a.correct && a.mode === 'exam' && a.examId === exam.id)).toBe(true);
    expect(log.find((a) => a.questionId === examIds[6])).toMatchObject({ chosen: 'B' });
  });

  it('changes nothing when a stale page submits an exam already finished, and still opens its results', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(optionFor('A'));
    const exam = await stored();
    await waitFor(async () => expect(Object.keys((await stored()).answers)).toHaveLength(1));
    expect(await finishExam(exam.id)).toBe(true);
    const finished = await getExam(exam.id);

    await user.click(screen.getByRole('button', { name: t.submit }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit }));
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));
    expect(await getExam(exam.id)).toEqual(finished);
    expect(await listAnswers()).toHaveLength(20);
  });

  it('ends a stale page whose answer the storage module refuses, logging nothing twice', async () => {
    const user = userEvent.setup();
    await start(user);
    const exam = await stored();
    expect(await finishExam(exam.id)).toBe(true);

    await user.click(optionFor('C'));
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));
    expect((await getExam(exam.id))?.answers).toEqual({});
    expect(await listAnswers()).toHaveLength(20);
  });

  it('submits itself as it stands when the clock reaches zero with the page open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    vi.setSystemTime(T0 + 29 * MINUTE + 58 * SECOND);
    const exam = await createExam(examIds, T0);
    await saveExamAnswers(exam.id, { [examIds[0]!]: question(examIds[0]!).answer, [examIds[1]!]: 'C' });
    renderExam();
    await screen.findByText('3 of 20');
    expect(clock()).toHaveTextContent('00:02');

    await act(() => vi.advanceTimersByTimeAsync(SECOND));
    expect(clock()).toHaveTextContent('00:01');
    expect(where()).toBe('/exam');
    await act(() => vi.advanceTimersByTimeAsync(SECOND));
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));

    const finished = await getExam(exam.id);
    expect(finished?.finishedAt).toBe(examDeadline(exam));
    expect(Object.keys(finished!.answers)).toHaveLength(2);
    expect(finished?.score).toBe(scoreExam(finished!));
    expect(finished?.score).toBe(question(examIds[1]!).answer === 'C' ? 2 : 1);
    const log = await listAnswers();
    expect(log).toHaveLength(20);
    expect(log.every((a) => a.at === examDeadline(exam) && a.mode === 'exam' && a.examId === exam.id)).toBe(true);
  });
});

describe('the results route', () => {
  it('shows the placeholder heading at /exam/results/<id>', () => {
    renderExam('/exam/results/abc');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
  });
});

describe('exam messages', () => {
  it('has every English key in Portuguese', () => {
    const [enKeys, ptKeys] = (['en', 'pt'] satisfies Locale[]).map((l) => Object.keys(MESSAGES[l].exam).sort());
    expect(ptKeys).toEqual(enKeys);
  });

  it('words the strings the e2e suite reads', () => {
    expect([t.start, t.previous, t.next, t.submit, t.position(1, 20), t.marker(1), t.timeLeft]).toEqual([
      'Start',
      'Previous',
      'Next',
      'Submit',
      '1 of 20',
      'Question 1',
      'Time left',
    ]);
  });
});
