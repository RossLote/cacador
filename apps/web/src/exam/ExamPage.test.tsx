import { translationFor, type OptionKey } from '@cacador/data';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, examDeadline, scoreExam, seededRandom } from '@/model';
import { closeStorage, createExam, finishExam, getExam, listAnswers, listExams, saveExamAnswer, type Exam } from '@/storage';
import { ExamPage } from './ExamPage';
import { question, wrongOf } from '../../test/fixtures';
import { failStore } from '../../test/storage';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = Date.UTC(2026, 9, 13, 9, 0);
const t = MESSAGES.en.exam;
const card = MESSAGES.en.practice.card;
const SEED = 7;
/** The questions Start draws with Math.random seeded as renderExam seeds it. */
const examIds = drawExam(seededRandom(SEED));

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

/** The exam screens at `path`, with Math.random a fresh seeded source, so Start draws `examIds`. */
function renderExam(path = '/exam') {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(SEED));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="exam/*" element={<ExamPage />} />
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
/** The bank id of the question on screen, from the card's wrapper (the running exam's card draws no "Question <id>"). */
const shownId = () => Number(document.querySelector('[data-question-id]')?.getAttribute('data-question-id'));
/** Submit, named by its label: "Submit · N unanswered" while `unanswered` is above 0, "Submit" at 0. */
const submitButton = (unanswered: number) =>
  screen.getByRole('button', { name: unanswered > 0 ? t.submitUnanswered(unanswered) : t.submit });

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
    await saveExamAnswer(exam.id, examIds[0]!, 'A', startedAt + MINUTE);

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
    // The screen header: the eyebrow over "1 of 20", the clock chip at its right.
    const header = screen.getByText('1 of 20').closest('header')!;
    expect(header).toContainElement(clock());
    expect(within(header).getByText(MESSAGES.en.common.nav.exam, { selector: 'p.eyebrow' })).toBeInTheDocument();

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
    expect(submitButton(20)).toBeEnabled();
    expect(screen.getByText(t.notMarked)).toBeInTheDocument();
    // The screen header holds the place, so the card draws no "Question <id>" of its own.
    expect(screen.queryByText(/^Question \d+$/)).not.toBeInTheDocument();
  });

  it('draws the current marker rust, the answered ones forest and the rest card, and counts the unanswered on Submit', async () => {
    const user = userEvent.setup();
    await start(user);
    expect(marker(1)).toHaveAttribute('data-state', 'current');
    expect(marker(1)).toHaveClass('bg-rust');
    expect(marker(2)).toHaveAttribute('data-state', 'unanswered');
    expect(marker(2)).toHaveClass('bg-card');

    await user.click(optionFor('A'));
    // Still current: the current look wins over answered.
    expect(marker(1)).toHaveAttribute('data-state', 'current');
    expect(submitButton(19)).toHaveTextContent('Submit · 19 unanswered');
    await user.click(screen.getByRole('button', { name: t.next }));
    expect(marker(1)).toHaveAttribute('data-state', 'answered');
    expect(marker(1)).toHaveClass('bg-forest');
    expect(marker(2)).toHaveAttribute('data-state', 'current');
    expect(marker(3)).toHaveAttribute('data-state', 'unanswered');
    expect(screen.getByRole('navigation', { name: t.markers }).querySelectorAll('[data-state="answered"]')).toHaveLength(1);
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

    await user.click(optionFor(wrongOf(q.id)));
    expect(optionFor(wrongOf(q.id))).toHaveAttribute('aria-pressed', 'true');
    for (const key of ['A', 'B', 'C'] as const) {
      expect(optionFor(key)).toBeEnabled();
      expect(optionFor(key)).not.toHaveAttribute('data-mark');
    }
    for (const word of [card.right, card.wrong, card.correctAnswer]) expect(screen.queryByText(word)).not.toBeInTheDocument();
    expect(marker(1)).toHaveAttribute('data-answered', 'true');
    expect(marker(1)).toHaveAccessibleDescription(t.answered);
    await waitFor(async () => expect((await stored()).answers).toEqual({ [q.id]: wrongOf(q.id) }));

    await user.click(optionFor(q.answer));
    expect(optionFor(q.answer)).toHaveAttribute('aria-pressed', 'true');
    expect(optionFor(wrongOf(q.id))).toHaveAttribute('aria-pressed', 'false');
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

  it('takes back an answer that could not be saved, says so, and saves the next tap', async () => {
    const user = userEvent.setup();
    await start(user);
    const q = question(examIds[0]!);
    await user.click(optionFor('A'));
    await waitFor(async () => expect((await stored()).answers).toEqual({ [q.id]: 'A' }));

    let failing = failStore('put', { store: 'exams', times: 1 });
    await user.click(optionFor('B'));
    // What is on screen is what Submit would score: the stored A, not the B that was not saved.
    expect(await screen.findByText(t.answerNotSaved)).toBeInTheDocument();
    expect(optionFor('A')).toHaveAttribute('aria-pressed', 'true');
    expect(optionFor('B')).toHaveAttribute('aria-pressed', 'false');
    expect((await stored()).answers).toEqual({ [q.id]: 'A' });
    failing.mockRestore();

    await user.click(marker(2));
    failing = failStore('put', { store: 'exams', times: 1 });
    await user.click(optionFor('C'));
    expect(await screen.findByText(t.answerNotSaved)).toBeInTheDocument();
    await waitFor(() => expect(optionFor('C')).toHaveAttribute('aria-pressed', 'false'));
    expect(marker(2)).toHaveAttribute('data-answered', 'false');
    failing.mockRestore();

    await user.click(optionFor('C'));
    await waitFor(async () => expect((await stored()).answers).toEqual({ [q.id]: 'A', [examIds[1]!]: 'C' }));
    expect(screen.queryByText(t.answerNotSaved)).not.toBeInTheDocument();
    expect(optionFor('C')).toHaveAttribute('aria-pressed', 'true');
    expect(marker(2)).toHaveAttribute('data-answered', 'true');
  });

  it('saves an answer tapped before 30:00 whose save reaches storage after it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0 + 30 * MINUTE - 50);
    const exam = await createExam(examIds, T0);
    renderExam();
    await screen.findByText('1 of 20');

    vi.setSystemTime(examDeadline(exam) - 1);
    fireEvent.click(optionFor('B'));
    // The save runs after the tap, by which time the deadline has passed.
    vi.setSystemTime(examDeadline(exam) + 1);
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));

    const finished = await getExam(exam.id);
    expect(finished?.answers).toEqual({ [examIds[0]!]: 'B' });
    expect(finished?.finishedAt).toBe(examDeadline(exam));
    expect((await listAnswers()).find((a) => a.questionId === examIds[0])).toMatchObject({ chosen: 'B' });
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
      await user.click(optionFor(n % 2 === 0 ? q.answer : wrongOf(q.id)));
      if (n < 20) await user.click(screen.getByRole('button', { name: t.next }));
    }
    // Back to question 5 by its marker, and change it to the right answer.
    await user.click(marker(5));
    const fifth = question(examIds[4]!);
    await user.click(optionFor(fifth.answer));

    expect(submitButton(0)).toHaveTextContent(/^Submit$/);
    expect(screen.queryByRole('button', { name: /unanswered/ })).not.toBeInTheDocument();
    await user.click(submitButton(0));
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
    // Forty taps, then the results page draws nine cards: past the 5 s default on a loaded machine.
  }, 15_000);

  it('asks first when questions are unanswered, stays on Back to the exam, and logs the unanswered ones as wrong with no option', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(optionFor('A'));
    await user.click(marker(7));
    await user.click(optionFor('B'));

    await user.click(submitButton(18));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('18 unanswered — submit anyway?');
    await user.click(within(dialog).getByRole('button', { name: t.keepGoing }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(where()).toBe('/exam');
    expect((await stored()).finishedAt).toBeUndefined();

    await user.click(submitButton(18));
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

    await user.click(submitButton(19));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit }));
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));
    expect(await getExam(exam.id)).toEqual(finished);
    expect(await listAnswers()).toHaveLength(20);
  });

  it('shows the not-found page for an address under /exam that names no screen', async () => {
    renderExam('/exam/nope');

    expect(await screen.findByRole('heading', { name: MESSAGES.en.common.notFound.title })).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.en.common.notFound.body)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.start })).not.toBeInTheDocument();
    expect(await listExams()).toEqual([]);
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

  it('stays on the exam and says so when Submit cannot finish it, and Submit again opens the results', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(optionFor('A'));
    await waitFor(async () => expect(Object.keys((await stored()).answers)).toHaveLength(1));

    failStore('put', { store: 'exams', times: 1 });
    await user.click(submitButton(19));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit }));
    expect(await screen.findByText(t.submitFailed)).toBeInTheDocument();
    expect(where()).toBe('/exam');
    expect((await stored()).finishedAt).toBeUndefined();
    expect(await listAnswers()).toEqual([]);
    expect(submitButton(19)).toBeEnabled();
    expect(optionFor('A')).toBeEnabled();

    await user.click(submitButton(19));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit }));
    const exam = await stored();
    await waitFor(() => expect(where()).toBe(`/exam/results/${exam.id}`));
    expect((await stored()).finishedAt).toBeTypeOf('number');
    expect(await listAnswers()).toHaveLength(20);
  });

  it('leaves the learner where they went when the finish settles after they left the exam', async () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(SEED));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/exam']}>
        <Link to="/">Home</Link>
        <Routes>
          <Route index element={<p>Home page</p>} />
          <Route path="exam/*" element={<ExamPage />} />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    await user.click(await startButton());
    await screen.findByText(t.position(1, 20));
    await user.click(submitButton(20));
    const confirm = within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.confirmSubmit });

    // Submit, then Home before the finish has reached storage.
    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(where()).toBe('/');
    await waitFor(async () => expect((await stored()).finishedAt).toBeTypeOf('number'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(where()).toBe('/');
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('submits itself as it stands when the clock reaches zero with the page open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    vi.setSystemTime(T0 + 29 * MINUTE + 58 * SECOND);
    const exam = await createExam(examIds, T0);
    await saveExamAnswer(exam.id, examIds[0]!, question(examIds[0]!).answer);
    await saveExamAnswer(exam.id, examIds[1]!, 'C');
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
  it('routes /exam/results/<id> to the results, which say an unknown id is not a finished exam', async () => {
    renderExam('/exam/results/abc');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.title);
    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
  });
});

describe('exam messages', () => {
  it('has every English key in Portuguese', () => {
    const [enKeys, ptKeys] = (['en', 'pt'] satisfies Locale[]).map((l) => Object.keys(MESSAGES[l].exam).sort());
    expect(ptKeys).toEqual(enKeys);
  });

  it('words the strings the e2e suite reads', () => {
    expect([
      t.start,
      t.previous,
      t.next,
      t.submit,
      t.submitUnanswered(19),
      t.position(1, 20),
      t.marker(1),
      t.timeLeft,
      t.notMarked,
    ]).toEqual([
      'Start',
      'Previous',
      'Next',
      'Submit',
      'Submit · 19 unanswered',
      '1 of 20',
      'Question 1',
      'Time left',
      'Answers are not marked until you submit. No English and no hints during the exam.',
    ]);
  });

  it('words the new Portuguese strings with the file\'s own verb and word for hints', () => {
    const pt = MESSAGES.pt.exam;
    expect(pt.submitUnanswered(19)).toBe('Entregar · 19 por responder');
    expect(pt.notMarked).toBe('As respostas só são corrigidas quando entregar. Sem inglês nem dicas durante o exame.');
  });
});
