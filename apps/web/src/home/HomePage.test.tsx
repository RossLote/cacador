import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RUST_HOVER } from '@/components/styles';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, GROUPS, seededRandom } from '@/model';
import { closeStorage, createExam, listAnswers, recordAnswer } from '@/storage';
import { HomePage } from './HomePage';
import { correctOf, wrongOf } from '../../test/fixtures';
import { answerExam, failStore } from '../../test/storage';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = Date.UTC(2026, 9, 13, 9, 0);
const en = MESSAGES.en;
const examIds = drawExam(seededRandom(7));

/** The manifest's n-th topic. */
function topicAt(n: number) {
  const topic = GROUPS.topic[n];
  if (!topic) throw new Error(`no topic ${n}`);
  return topic;
}
const [topicA, topicB, topicC, topicD] = [topicAt(0), topicAt(1), topicAt(2), topicAt(3)];

function renderHome() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="exam" element={<p>exam screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The exam card, once Home has read storage. */
const examCard = () => screen.findByRole('link', { name: new RegExp(`^${en.home.examInProgress} `) });

/** Answers the first question of `pool` in practice: right, wrong, or right then wrong (a recent share of a half). */
async function answerFirstOf(pool: readonly number[], how: 'right' | 'wrong' | 'half') {
  const id = pool[0];
  if (id === undefined) throw new Error('empty pool');
  const choices = how === 'right' ? [correctOf(id)] : how === 'wrong' ? [wrongOf(id)] : [correctOf(id), wrongOf(id)];
  for (const [n, chosen] of choices.entries()) await recordAnswer({ questionId: id, chosen, mode: 'practice', at: T0 + n * MINUTE });
}

/** The Weakest topics section, or null when Home shows none. */
const weakest = (t = en) => screen.queryByRole('region', { name: t.home.weakestTopics });

describe('Home', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    it(`shows the header, the readiness plate, the three cards and nothing else on a fresh device (${locale})`, async () => {
      act(() => setLocale(locale));
      renderHome();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Caçador');
      expect(heading).toHaveClass('font-heading');
      expect(screen.getByRole('link', { name: t.common.nav.settings })).toHaveAttribute('href', '/settings');

      const plate = screen.getByRole('region', { name: t.home.readiness });
      expect(await within(plate).findByText(t.home.percent(33))).toHaveClass('font-heading');
      expect(within(plate).getByText(t.home.unseen(506))).toBeInTheDocument();
      expect(within(plate).getByText(t.home.passLine(75))).toHaveClass('text-rust');
      expect(within(plate).getByRole('progressbar', { name: t.home.readiness })).toHaveAttribute('aria-valuenow', '33');
      const tick = plate.querySelector('[data-slot="pass-tick"]');
      expect(tick).toHaveClass('bg-rust');
      expect(tick).toHaveStyle({ left: '75%' });

      const round = `${t.home.roundTitle(10)} ${t.home.roundLine}`;
      const practice = `${t.common.nav.practice} ${t.home.practiceLine}`;
      const exam = `${t.common.nav.exam} ${t.home.examLine(20, 30)}`;
      expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
        '/settings',
        '/practice?round=10',
        '/practice',
        '/exam',
      ]);
      expect(document.querySelectorAll('[data-slot="start-card"]')).toHaveLength(3);
      expect(screen.getByRole('link', { name: round })).toHaveAttribute('href', '/practice?round=10');
      expect(screen.getByRole('link', { name: practice })).toHaveAttribute('href', '/practice');
      expect(screen.getByRole('link', { name: exam })).toHaveAttribute('href', '/exam');
      // An exact query for the nav words finds no card: on the whole app it finds the tab only.
      expect(screen.queryByRole('link', { name: t.common.nav.practice })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: t.common.nav.exam })).not.toBeInTheDocument();

      expect(screen.queryByText(t.home.examInProgress)).not.toBeInTheDocument();
      expect(weakest(t)).not.toBeInTheDocument();
      expect(screen.queryByText(t.home.weakestTopics)).not.toBeInTheDocument();
    });
  }

  it('words the fresh-device numbers and the cards exactly as the e2e suite reads them', async () => {
    renderHome();
    expect(await screen.findByText('33 %')).toBeInTheDocument();
    expect(screen.getByText('506 unseen')).toBeInTheDocument();
    expect(screen.getByText('Pass line 75 %')).toBeInTheDocument();
    // The round is the one thing to do next, filled rust and the width of the row; Practice and Exam carry the ink hairline.
    const round = screen.getByRole('link', { name: 'Quick 10 Weak ones first, then your score' });
    expect(round).toHaveClass('bg-rust', RUST_HOVER, 'col-span-2');
    expect(round).not.toHaveClass('hover:bg-rust/90');
    expect(round.querySelector('svg.lucide-zap')).toBeInTheDocument();
    const practice = screen.getByRole('link', { name: 'Practice Weak ones first' });
    expect(practice).toHaveClass('border-ink');
    expect(practice).not.toHaveClass('bg-rust', 'col-span-2');
    expect(screen.getByRole('link', { name: 'Exam 20 questions · 30 min' })).toHaveClass('border-ink');
  });

  it('keeps the loading line until storage answers, then drops it', async () => {
    renderHome();
    expect(screen.getByRole('status')).toHaveTextContent(en.home.loading);
    expect(await screen.findByText('33 %')).toBeInTheDocument();
    expect(screen.queryByText(en.home.loading)).not.toBeInTheDocument();
  });

  it('says so when storage cannot be read, and still offers the three cards', async () => {
    failStore('getAll');
    renderHome();
    expect(await screen.findByText(en.home.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(en.home.loadFailed);
    expect(document.querySelectorAll('[data-slot="start-card"]')).toHaveLength(3);
    expect(weakest()).not.toBeInTheDocument();
  });

  it('follows the model: unseen is 506 minus the distinct questions answered', async () => {
    for (const questionId of [1, 2, 3, 4, 5]) {
      await recordAnswer({ questionId, chosen: correctOf(questionId), mode: 'practice', at: T0 });
    }
    await recordAnswer({ questionId: 1, chosen: 'A', mode: 'practice', at: T0 + MINUTE });
    renderHome();

    // Four questions at 1, question 1 at 1/2, 501 unseen at 1/3: 171.5 / 506 = 33.9 %.
    expect(await screen.findByText('501 unseen')).toBeInTheDocument();
    expect(screen.getByText('34 %')).toBeInTheDocument();
  });

  describe('Weakest topics', () => {
    it('shows one row, in forest at 75 % or above, when one topic is started', async () => {
      await answerFirstOf(topicB.pool, 'right');
      renderHome();

      const section = await screen.findByRole('region', { name: en.home.weakestTopics });
      const rows = within(section).getAllByRole('listitem');
      expect(rows).toHaveLength(1);
      const row = within(section).getByRole('link', { name: `${topicB.en}: 100 %, seen 1 of ${topicB.pool.length}` });
      expect(row).toHaveAttribute('href', `/practice?topic=${topicB.slug}`);
      expect(row).toHaveTextContent(`${topicB.en}Seen 1 of ${topicB.pool.length}100 %`);
      expect(within(row).getByText('100 %')).toHaveClass('font-heading', 'text-forest');
      expect(within(section).getByRole('link', { name: en.home.allTopics })).toHaveAttribute('href', '/progress');
    });

    it('shows the two lowest of three or more started topics, worst first, in rust under 75 %', async () => {
      await answerFirstOf(topicA.pool, 'half');
      await answerFirstOf(topicB.pool, 'right');
      await answerFirstOf(topicC.pool, 'wrong');
      await answerFirstOf(topicD.pool, 'right');
      renderHome();

      const section = await screen.findByRole('region', { name: en.home.weakestTopics });
      const rows = within(section).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      const [worst, next] = rows.map((item) => within(item).getByRole('link'));
      if (!worst || !next) throw new Error('two rows expected');
      expect(worst).toHaveAccessibleName(`${topicC.en}: 0 %, seen 1 of ${topicC.pool.length}`);
      expect(worst).toHaveAttribute('href', `/practice?topic=${topicC.slug}`);
      expect(next).toHaveAccessibleName(`${topicA.en}: 50 %, seen 1 of ${topicA.pool.length}`);
      expect(next).toHaveAttribute('href', `/practice?topic=${topicA.slug}`);
      expect(within(worst).getByText('0 %')).toHaveClass('text-rust');
      expect(within(next).getByText('50 %')).toHaveClass('text-rust');
      expect(within(section).getByRole('link', { name: en.home.allTopics })).toHaveAttribute('href', '/progress');
    });

    it('names the topics and the rows in Portuguese', async () => {
      act(() => setLocale('pt'));
      const pt = MESSAGES.pt;
      await answerFirstOf(topicA.pool, 'wrong');
      renderHome();

      const section = await screen.findByRole('region', { name: pt.home.weakestTopics });
      expect(within(section).getByRole('link', { name: pt.home.allTopics })).toHaveAttribute('href', '/progress');
      const row = within(section).getByRole('link', { name: `${topicA.pt}: 0 %, vistas 1 de ${topicA.pool.length}` });
      expect(row).toHaveTextContent(pt.home.seen(1, topicA.pool.length));
    });
  });

  describe('the exam in progress', () => {
    it('shows the minutes left rounded up and 0 answered, and opens /exam', async () => {
      const user = userEvent.setup();
      await createExam(examIds, Date.now() - 30 * SECOND);
      renderHome();

      const card = await examCard();
      expect(card).toHaveAccessibleName(`${en.home.examInProgress} ${en.home.examStatus(30, 0, 20)}`);
      expect(card).toHaveTextContent('30 minutes left · 0 of 20 answered');
      expect(card).toHaveClass('bg-clay', 'border-rust', 'text-ink');
      expect(card).toHaveAttribute('href', '/exam');
      // The timer and the chevron, at the one icon stroke (DESIGN.md § 8.5).
      const icons = card.querySelectorAll('svg');
      expect(icons).toHaveLength(2);
      for (const icon of icons) expect(icon).toHaveAttribute('stroke-width', '1.75');

      await user.click(card);
      expect(screen.getByText('exam screen')).toBeInTheDocument();
    });

    it("counts the exam's saved answers", async () => {
      const exam = await createExam(examIds, Date.now() - 3 * MINUTE);
      await answerExam(exam.id, Object.fromEntries(examIds.slice(0, 7).map((id) => [id, wrongOf(id)])));
      renderHome();
      expect(await examCard()).toHaveTextContent('27 minutes left · 7 of 20 answered');
    });

    it('shows 20 minutes for 19:30 left and 1 minute for the last seconds', async () => {
      await createExam(examIds, Date.now() - (10 * MINUTE + 30 * SECOND));
      const { unmount } = renderHome();
      expect(await examCard()).toHaveTextContent('20 minutes left');
      unmount();

      await closeStorage();
      vi.stubGlobal('indexedDB', new IDBFactory());
      await createExam(examIds, Date.now() - (29 * MINUTE + 50 * SECOND));
      renderHome();
      expect(await examCard()).toHaveTextContent('1 minute left · 0 of 20 answered');
    });

    it('shows the card in Portuguese', async () => {
      act(() => setLocale('pt'));
      const pt = MESSAGES.pt;
      const exam = await createExam(examIds, Date.now() - 30 * SECOND);
      await answerExam(exam.id, Object.fromEntries(examIds.slice(0, 1).map((id) => [id, correctOf(id)])));
      renderHome();
      const card = await screen.findByRole('link', { name: new RegExp(`^${pt.home.examInProgress} `) });
      expect(card).toHaveTextContent(pt.home.examStatus(30, 1, 20));
      expect(card).toHaveTextContent('Faltam 30 minutos · 1 de 20 respondidas');
    });

    it('shows no card for an exam started 31 minutes ago, and counts its 20 questions as seen', async () => {
      const startedAt = Date.now() - 31 * MINUTE;
      const exam = await createExam(examIds, startedAt);
      const answered = examIds.slice(0, 12);
      await answerExam(exam.id, Object.fromEntries(answered.map((id) => [id, correctOf(id)])), startedAt + MINUTE);
      renderHome();

      // 12 right at 1, 8 unanswered at 0, 486 unseen at 1/3: 174 / 506 = 34.4 %.
      expect(await screen.findByText('486 unseen')).toBeInTheDocument();
      expect(screen.getByText('34 %')).toBeInTheDocument();
      expect(screen.queryByText(en.home.examInProgress)).not.toBeInTheDocument();
      expect(await listAnswers()).toHaveLength(20);
    });

    it('counts the minutes down while open and drops the card at the deadline', async () => {
      // Time runs on as well, so Testing Library's own zero-delay waits still fire.
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
      vi.setSystemTime(T0 + 28 * MINUTE + 30 * SECOND);
      await createExam(examIds, T0);
      renderHome();

      expect(await examCard()).toHaveTextContent('2 minutes left');
      await act(() => vi.advanceTimersByTimeAsync(30 * SECOND));
      expect(await examCard()).toHaveTextContent('1 minute left');

      await act(() => vi.advanceTimersByTimeAsync(MINUTE));
      expect(await screen.findByText('486 unseen')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(en.home.examInProgress)).not.toBeInTheDocument());
      expect(screen.queryByText(/\b0 minutes left/)).not.toBeInTheDocument();
    });
  });
});

describe('home messages', () => {
  it('has every English key in Portuguese', () => {
    const [enKeys, ptKeys] = (['en', 'pt'] satisfies Locale[]).map((l) => Object.keys(MESSAGES[l].home).sort());
    expect(ptKeys).toEqual(enKeys);
  });
});
