import { questionsInTopic } from '@cacador/data';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, seededRandom } from '@/model';
import { ACCURACY_DAYS } from '@/model/progress';
import {
  clearProgress,
  createExam,
  exportProgress,
  finishExam,
  importProgress,
  recordAnswer,
  setFlag,
} from '@/storage';
import { ProgressPage } from './ProgressPage';
import { correctOf, wrongOf } from '../../test/fixtures';
import { answerExam } from '../../test/storage';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
/** 13 Oct 2026, 15:00 on the device's clock. */
const NOW = new Date(2026, 9, 13, 15, 0).getTime();
const en = MESSAGES.en;

const firstIn = (topic: string, n = 0): number => {
  const q = questionsInTopic(topic)[n];
  if (!q) throw new Error(`no question ${n} in ${topic}`);
  return q.id;
};

async function answer(questionId: number, correct: boolean, at = NOW) {
  await recordAnswer({ questionId, chosen: correct ? correctOf(questionId) : wrongOf(questionId), mode: 'practice', at });
}

function Where() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p>at {pathname + search}</p>
      <button type="button" onClick={() => void navigate(-1)}>
        back
      </button>
    </>
  );
}

function renderProgress() {
  return render(
    <MemoryRouter initialEntries={['/progress']}>
      <Routes>
        <Route path="progress" element={<ProgressPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The rows of the list in the open tab, in order, by accessible name. */
const rowNames = () =>
  within(screen.getByRole('tabpanel'))
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label'));

const dayBars = () => within(screen.getByRole('list', { name: en.progress.daysChart })).getAllByRole('img');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

describe('Progress on a fresh device', () => {
  it('shows 33 %, 506 unseen, 30 empty bars, every row not started, no exams and Flagged (0)', async () => {
    const user = userEvent.setup();
    renderProgress();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Progress');
    expect(await screen.findByText('33 %')).toBeInTheDocument();
    expect(screen.getByText('506 unseen')).toBeInTheDocument();
    expect(screen.getByText('Pass line 75 %')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: en.progress.days(ACCURACY_DAYS) })).toHaveTextContent('Last 30 days');

    const bars = dayBars();
    expect(bars).toHaveLength(30);
    expect(bars[0]).toHaveAccessibleName('14 Sept: 0 answers, 0 right');
    expect(bars[29]).toHaveAccessibleName('Today, 13 Oct: 0 answers, 0 right');
    expect(screen.getByText('Today: 0 answers, 0 right')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    let rows = rowNames();
    expect(rows).toHaveLength(29);
    expect(rows.every((name) => name?.includes(': not started, '))).toBe(true);
    expect(rows[0]).toBe("Hunter's documents: not started, 10 questions");
    expect(screen.getByRole('link', { name: /^Ducks:/ })).toHaveTextContent(/Not started/);

    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    rows = rowNames();
    expect(rows).toHaveLength(11);
    expect(rows.every((name) => name?.includes(': not started, '))).toBe(true);

    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    rows = rowNames();
    expect(rows).toHaveLength(17);
    expect(rows.every((name) => name?.includes(': not started, '))).toBe(true);

    expect(screen.getByText(en.progress.noExams)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Flagged (0)' })).toHaveAttribute('href', '/flagged');
  });

  it('reads in European Portuguese', async () => {
    const user = userEvent.setup();
    act(() => setLocale('pt'));
    const pt = MESSAGES.pt.progress;
    renderProgress();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(pt.title);
    expect(await screen.findByText('506 por ver')).toBeInTheDocument();
    expect(screen.getByText('Hoje: 0 respostas, 0 certas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Patos: por começar, 28 perguntas' })).toHaveAttribute(
      'href',
      '/practice?topic=patos',
    );
    await user.click(screen.getByRole('tab', { name: pt.patterns }));
    expect(screen.getByRole('link', { name: /^só, apenas: por começar/ })).toBeInTheDocument();
    expect(screen.getByText(pt.noExams)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Assinalações (0)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Últimos 30 dias' })).toBeInTheDocument();
  });
});

describe('Progress with answers', () => {
  it('counts five answers on five questions: 501 unseen, today 5 with 3 right, rows worst first', async () => {
    const ducks = [firstIn('patos', 0), firstIn('patos', 1)];
    await answer(firstIn('coelho'), false);
    await answer(ducks[0] as number, true);
    await answer(ducks[1] as number, false);
    await answer(firstIn('lebre'), true);
    await answer(firstIn('javali'), true);
    renderProgress();

    expect(await screen.findByText('501 unseen')).toBeInTheDocument();
    expect(dayBars()[29]).toHaveAccessibleName('Today, 13 Oct: 5 answers, 3 right');
    expect(screen.getByText('Today: 5 answers, 3 right')).toBeInTheDocument();

    const rows = rowNames();
    expect(rows.slice(0, 4)).toEqual([
      'Wild rabbit: 0 %, seen 1 of 29',
      'Ducks: 50 %, seen 2 of 28',
      // Ties keep the manifest order: hare before boar.
      'Iberian hare: 100 %, seen 1 of 17',
      'Wild boar: 100 %, seen 1 of 14',
    ]);
    expect(rows.slice(4).every((name) => name?.includes(': not started, '))).toBe(true);
    expect(rows[4]).toBe("Hunter's documents: not started, 10 questions");

    const duck = screen.getByRole('link', { name: 'Ducks: 50 %, seen 2 of 28' });
    expect(duck).toHaveTextContent('50 %');
    expect(duck).toHaveTextContent('Seen 2 of 28');
  });

  it('puts each answer on its own day and leaves out answers older than 30 days', async () => {
    await answer(1, true, NOW - 3 * DAY);
    await answer(2, false, NOW - 3 * DAY);
    await answer(3, true, NOW - 29 * DAY);
    await answer(4, true, NOW - 31 * DAY);
    renderProgress();

    await screen.findByText('502 unseen');
    const bars = dayBars();
    expect(bars[26]).toHaveAccessibleName('10 Oct: 2 answers, 1 right');
    expect(bars[0]).toHaveAccessibleName('14 Sept: 1 answer, 1 right');
    expect(bars.reduce((sum, bar) => sum + (bar.getAttribute('aria-label')?.includes(': 0 answers') ? 0 : 1), 0)).toBe(2);
    expect(screen.getByText('Today: 0 answers, 0 right')).toBeInTheDocument();
  });

  it('links each row into focused practice: Ducks opens /practice?topic=patos', async () => {
    const user = userEvent.setup();
    renderProgress();

    const duck = await screen.findByRole('link', { name: /^Ducks:/ });
    expect(duck).toHaveAttribute('href', '/practice?topic=patos');

    await user.click(screen.getByRole('tab', { name: 'Sections' }));
    expect(screen.getByRole('link', { name: /^Biology:/ })).toHaveAttribute('href', '/practice?section=biologia');
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    expect(screen.getByRole('link', { name: /^Only \(só, apenas\):/ })).toHaveAttribute('href', '/practice?pattern=only');

    await user.click(screen.getByRole('tab', { name: 'Topics' }));
    await user.click(screen.getByRole('link', { name: /^Ducks:/ }));
    expect(screen.getByText('at /practice?topic=patos')).toBeInTheDocument();
  });

  it('shows the flag count', async () => {
    await setFlag(1, 'translation');
    await setFlag(1, 'hint');
    await setFlag(7, 'hint', 'odd');
    renderProgress();
    expect(await screen.findByRole('link', { name: 'Flagged (3)' })).toHaveAttribute('href', '/flagged');
  });

  it('counts flags, not questions, in Portuguese: three flags on two questions read Assinalações (3)', async () => {
    act(() => setLocale('pt'));
    await setFlag(1, 'translation');
    await setFlag(1, 'hint');
    await setFlag(7, 'hint', 'odd');
    renderProgress();
    expect(await screen.findByRole('link', { name: 'Assinalações (3)' })).toHaveAttribute('href', '/flagged');
  });

  it('keeps the chosen list in the address, so back from focused practice returns to it', async () => {
    const user = userEvent.setup();
    renderProgress();

    await user.click(await screen.findByRole('tab', { name: 'Sections' }));
    await user.click(screen.getByRole('link', { name: /^Biology:/ }));
    expect(screen.getByText('at /practice?section=biologia')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(await screen.findByRole('tab', { name: 'Sections' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /^Biology:/ })).toBeInTheDocument();

    // Back to Topics drops the parameter; switching never adds a history entry.
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    await user.click(screen.getByRole('tab', { name: 'Topics' }));
    await user.click(screen.getByRole('link', { name: /^Ducks:/ }));
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(await screen.findByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves today on when the page is shown again after midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58));
    await answer(1, true, Date.now());
    renderProgress();
    expect(await screen.findByText('Today: 1 answer, 1 right')).toBeInTheDocument();
    expect(dayBars()[29]).toHaveAccessibleName('Today, 13 Oct: 1 answer, 1 right');

    vi.setSystemTime(new Date(2026, 9, 14, 0, 1));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByText('Today: 0 answers, 0 right')).toBeInTheDocument();
    expect(dayBars()[29]).toHaveAccessibleName('Today, 14 Oct: 0 answers, 0 right');
    expect(dayBars()[28]).toHaveAccessibleName('13 Oct: 1 answer, 1 right');
  });
});

describe('Progress restyle (D10)', () => {
  it('puts the readiness in the header region, and today in rust over forest days on the plate', async () => {
    await answer(1, true, NOW - 2 * DAY);
    await answer(2, true);
    await answer(3, false);
    renderProgress();

    const readinessRegion = await screen.findByRole('region', { name: en.progress.readiness });
    expect(readinessRegion).toHaveTextContent(/34 %·503 unseen/);
    expect(within(screen.getByRole('banner')).getByRole('region', { name: en.progress.readiness })).toBe(readinessRegion);
    expect(readinessRegion.querySelector('span')).toHaveClass('font-heading');

    // One visible h1 in the header, in Fraunces, between the back control and the readiness; no eyebrow.
    const banner = screen.getByRole('banner');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1).toHaveTextContent('Progress');
    expect(h1).toHaveClass('font-heading', 'text-[28px]');
    expect(h1).not.toHaveClass('sr-only');
    expect(banner.querySelector('.eyebrow')).toBeNull();
    expect(banner.firstElementChild).toHaveAccessibleName(en.common.backToHome);
    expect(h1.nextElementSibling).toBe(readinessRegion);

    const plate = screen.getByRole('region', { name: en.progress.days(ACCURACY_DAYS) });
    expect(within(plate).getByText('Today: 2 answers, 1 right')).toBeInTheDocument();
    expect(within(plate).getByText('14 Sept')).toBeInTheDocument();
    expect(within(plate).getByText('Today')).toHaveClass('text-rust');
    expect(within(plate).getByRole('list', { name: en.progress.daysChart })).toHaveClass('border-ink');

    const older = dayBars()[27] as HTMLElement;
    const today = dayBars()[29] as HTMLElement;
    expect(older.querySelector('[data-slot="day-right"]')).toHaveClass('bg-forest');
    expect(today.querySelector('[data-slot="day-right"]')).toHaveClass('bg-rust');
    expect(today.querySelector('.bg-track')).not.toBeNull();
    // A day with no answers draws no block.
    expect(dayBars()[10]?.querySelector('div')).toBeNull();
  });

  it('colours a 50 % row rust and a 100 % row forest, and shows a dash in muted when not started (the 75 % edge is in groups.test.ts)', async () => {
    const ducks = [firstIn('patos', 0), firstIn('patos', 1)];
    await answer(ducks[0] as number, true);
    await answer(ducks[1] as number, false);
    await answer(firstIn('lebre'), true);
    renderProgress();

    const percentOf = (name: RegExp) =>
      within(screen.getByRole('link', { name })).getByText((_, el) => el?.getAttribute('data-slot') === 'row-percent');
    const fillOf = (name: RegExp) =>
      screen.getByRole('link', { name }).querySelector('[data-slot="mini-bar-fill"]') as HTMLElement;

    const ducksPercent = await waitFor(() => percentOf(/^Ducks:/));
    expect(ducksPercent).toHaveTextContent('50 %');
    expect(ducksPercent).toHaveClass('text-rust', 'font-heading');
    expect(fillOf(/^Ducks:/)).toHaveStyle({ width: '50%' });
    expect(fillOf(/^Ducks:/)).toHaveClass('bg-rust');

    expect(percentOf(/^Iberian hare:/)).toHaveTextContent('100 %');
    expect(percentOf(/^Iberian hare:/)).toHaveClass('text-forest');
    expect(fillOf(/^Iberian hare:/)).toHaveStyle({ width: '100%' });
    expect(fillOf(/^Iberian hare:/)).toHaveClass('bg-forest');

    const untouched = screen.getByRole('link', { name: "Hunter's documents: not started, 10 questions" });
    expect(untouched).toHaveTextContent('Not started · 10 questions');
    expect(within(untouched).getByText('—')).toHaveClass('text-muted-foreground');
    expect(untouched.querySelector('[data-slot="mini-bar-fill"]')).toHaveStyle({ width: '0%' });
  });

  it('shows the Flagged row with its flag icon and chevron', async () => {
    renderProgress();
    const link = await screen.findByRole('link', { name: 'Flagged (0)' });
    expect(link).toHaveClass('border-ink');
    expect(link.querySelectorAll('svg')).toHaveLength(2);
  });

  it('draws the open tab underlined in forest and the chips as moss and clay', async () => {
    const failedIds = drawExam(seededRandom(1));
    const failed = await createExam(failedIds, NOW - 3 * DAY);
    await answerExam(failed.id, Object.fromEntries(failedIds.slice(0, 14).map((id) => [id, correctOf(id)])), NOW - 3 * DAY);
    await finishExam(failed.id, NOW - 3 * DAY + 10 * MINUTE);
    const passedIds = drawExam(seededRandom(2));
    const passed = await createExam(passedIds, NOW - 2 * 60 * MINUTE);
    await answerExam(passed.id, Object.fromEntries(passedIds.slice(0, 15).map((id) => [id, correctOf(id)])), NOW - 2 * 60 * MINUTE);
    await finishExam(passed.id, NOW - 60 * MINUTE);
    renderProgress();

    // The open tab: forest text, bold and the 2 px forest line shown (opacity 100); the others draw neither.
    const open = await screen.findByRole('tab', { name: 'Topics' });
    const shut = screen.getByRole('tab', { name: 'Sections' });
    expect(open).toHaveAttribute('data-active');
    expect(open).toHaveClass('data-active:text-forest', 'data-active:font-bold', 'after:bg-forest', 'group-data-horizontal/tabs:after:h-0.5', 'data-active:after:opacity-100');
    expect(shut).not.toHaveAttribute('data-active');
    expect(shut).toHaveClass('after:opacity-0');

    const section = await screen.findByRole('region', { name: en.progress.exams });
    const [passedRow, failedRow] = within(section).getAllByRole('link');
    const passedChip = within(passedRow as HTMLElement).getByText('Passed');
    const failedChip = within(failedRow as HTMLElement).getByText('Not passed');
    expect(passedChip).toHaveAttribute('data-variant', 'success');
    expect(passedChip).toHaveClass('bg-accent', 'text-success');
    expect(failedChip).toHaveClass('border-destructive');
    expect(failedChip).toHaveAttribute('data-variant', 'destructive');
    expect(failedChip).toHaveClass('bg-clay', 'text-ink');
    expect(within(passedRow as HTMLElement).getByText('15 / 20')).toHaveClass('font-heading');
  });
});

describe('Past exams', () => {
  it('lists finished exams newest first with date, score and outcome, never the unfinished one', async () => {
    // A failed exam on 10 Oct: 14 of 20.
    const failedIds = drawExam(seededRandom(1));
    const failed = await createExam(failedIds, NOW - 3 * DAY);
    await answerExam(failed.id, Object.fromEntries(failedIds.slice(0, 14).map((id) => [id, correctOf(id)])), NOW - 3 * DAY);
    expect(await finishExam(failed.id, NOW - 3 * DAY + 10 * MINUTE)).toBe(true);

    // A passed exam this morning: 15 right, 5 wrong.
    const passedIds = drawExam(seededRandom(2));
    const passed = await createExam(passedIds, NOW - 2 * 60 * MINUTE);
    await answerExam(passed.id, Object.fromEntries(passedIds.map((id, i) => [id, i < 15 ? correctOf(id) : wrongOf(id)])), NOW - 2 * 60 * MINUTE);
    expect(await finishExam(passed.id, NOW - 2 * 60 * MINUTE + 20 * MINUTE)).toBe(true);

    // One still running: never a row.
    const running = await createExam(drawExam(seededRandom(3)), NOW - 5 * MINUTE);

    const user = userEvent.setup();
    renderProgress();

    const section = await screen.findByRole('region', { name: en.progress.exams });
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      '13 Oct 2026: 15 of 20, Passed',
      '10 Oct 2026: 14 of 20, Not passed',
    ]);
    expect(links[0]).toHaveTextContent('15 / 20');
    expect(links[0]).toHaveTextContent('Passed');
    expect(links[1]).toHaveTextContent('14 / 20');
    expect(links[1]).toHaveTextContent('Not passed');
    expect(links[0]).toHaveAttribute('href', `/exam/results/${passed.id}`);
    expect(links[1]).toHaveAttribute('href', `/exam/results/${failed.id}`);
    expect(screen.queryByRole('link', { name: new RegExp(running.id) })).not.toBeInTheDocument();
    expect(screen.queryByText(en.progress.noExams)).not.toBeInTheDocument();

    // The passed exam's 20 answers are today's.
    expect(screen.getByText('Today: 20 answers, 15 right')).toBeInTheDocument();

    await user.click(links[0] as HTMLElement);
    expect(screen.getByText(`at /exam/results/${passed.id}`)).toBeInTheDocument();
  });

  it('settles an exam past its deadline first and lists it', async () => {
    const ids = drawExam(seededRandom(4));
    const exam = await createExam(ids, NOW - 45 * MINUTE);
    await answerExam(exam.id, { [ids[0] as number]: correctOf(ids[0] as number) }, NOW - 44 * MINUTE);
    renderProgress();

    const section = await screen.findByRole('region', { name: en.progress.exams });
    expect(within(section).getByRole('link', { name: '13 Oct 2026: 1 of 20, Not passed' })).toHaveAttribute(
      'href',
      `/exam/results/${exam.id}`,
    );
    expect(screen.getByText('486 unseen')).toBeInTheDocument();
  });
});

describe('Past exams order and score', () => {
  it('lists overlapping exams newest finished first, as their dates read', async () => {
    // B started first but finished last; A started later and finished first (two devices merged:
    // one device cannot start A while B runs, so B comes in from a file).
    const b = await createExam(drawExam(seededRandom(5)), NOW - 70 * MINUTE);
    expect(await finishExam(b.id, NOW - 45 * MINUTE)).toBe(true);
    const fromOtherDevice = await exportProgress();
    await clearProgress();
    const a = await createExam(drawExam(seededRandom(6)), NOW - 60 * MINUTE);
    expect(await finishExam(a.id, NOW - 58 * MINUTE)).toBe(true);
    expect((await importProgress(JSON.stringify(fromOtherDevice))).ok).toBe(true);
    renderProgress();

    const section = await screen.findByRole('region', { name: en.progress.exams });
    expect(within(section).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      `/exam/results/${b.id}`,
      `/exam/results/${a.id}`,
    ]);
  });

  it('shows the score worked out from the answers, as the results page does, not a stored one that disagrees', async () => {
    const ids = drawExam(seededRandom(8));
    const exam = await createExam(ids, NOW - 60 * MINUTE);
    await answerExam(exam.id, Object.fromEntries(ids.slice(0, 3).map((id) => [id, correctOf(id)])), NOW - 59 * MINUTE);
    expect(await finishExam(exam.id, NOW - 50 * MINUTE)).toBe(true);
    // A file whose stored score says 20 for the same answers.
    const file = await exportProgress();
    await clearProgress();
    await importProgress(JSON.stringify({ ...file, exams: file.exams.map((e) => ({ ...e, score: 20 })) }));
    renderProgress();

    const section = await screen.findByRole('region', { name: en.progress.exams });
    expect(within(section).getByRole('link')).toHaveAccessibleName('13 Oct 2026: 3 of 20, Not passed');
  });
});

describe('progress messages', () => {
  it('has every English key in Portuguese', () => {
    const [enKeys, ptKeys] = (['en', 'pt'] satisfies Locale[]).map((l) => Object.keys(MESSAGES[l].progress).sort());
    expect(ptKeys).toEqual(enKeys);
  });
});
