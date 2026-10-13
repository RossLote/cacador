import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, seededRandom } from '@/model';
import { closeStorage, createExam, listAnswers, recordAnswer, saveExamAnswers } from '@/storage';
import { HomePage } from './HomePage';
import { correctOf } from '../../test/fixtures';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = Date.UTC(2026, 9, 13, 9, 0);
const en = MESSAGES.en;
const examIds = drawExam(seededRandom(7));

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
const examCard = () => screen.findByRole('link', { name: new RegExp(en.home.examInProgress) });

afterEach(() => {
  vi.useRealTimers();
});

describe('Home', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    it(`shows the name, 33 %, the pass line, 506 unseen, the four buttons and no exam card on a fresh device (${locale})`, async () => {
      act(() => setLocale(locale));
      renderHome();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Caçador');
      expect(await screen.findByText(t.home.percent(33))).toBeInTheDocument();
      expect(screen.getByText(t.home.unseen(506))).toBeInTheDocument();
      expect(screen.getByText(t.home.passLine(75))).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: t.home.readiness })).toHaveAttribute('aria-valuenow', '33');
      for (const [path, key] of [
        ['/practice', 'practice'],
        ['/exam', 'exam'],
        ['/progress', 'progress'],
        ['/settings', 'settings'],
      ] as const) {
        expect(screen.getByRole('link', { name: t.common.nav[key] })).toHaveAttribute('href', path);
      }
      expect(screen.getAllByRole('link')).toHaveLength(4);
      expect(screen.queryByText(t.home.examInProgress)).not.toBeInTheDocument();
    });
  }

  it('words the fresh-device numbers exactly as the e2e suite reads them', async () => {
    renderHome();
    expect(await screen.findByText('33 %')).toBeInTheDocument();
    expect(screen.getByText('506 unseen')).toBeInTheDocument();
    expect(screen.getByText('Pass line 75 %')).toBeInTheDocument();
  });

  it('follows the model: unseen is 506 minus the distinct questions answered', async () => {
    for (const questionId of [1, 2, 3, 4, 5]) {
      await recordAnswer({ questionId, chosen: correctOf(questionId), correct: true, mode: 'practice', at: T0 });
    }
    await recordAnswer({ questionId: 1, chosen: 'A', correct: false, mode: 'practice', at: T0 + MINUTE });
    renderHome();

    // Four questions at 1, question 1 at 1/2, 501 unseen at 1/3: 171.5 / 506 = 33.9 %.
    expect(await screen.findByText('501 unseen')).toBeInTheDocument();
    expect(screen.getByText('34 %')).toBeInTheDocument();
  });

  it('shows the exam in progress with the minutes left rounded up, and opens /exam', async () => {
    const user = userEvent.setup();
    await createExam(examIds, Date.now() - 30 * SECOND);
    renderHome();

    const card = await examCard();
    expect(card).toHaveTextContent(en.home.minutesLeft(30));
    expect(card).toHaveTextContent('30 minutes left');
    expect(card).toHaveAttribute('href', '/exam');

    await user.click(card);
    expect(screen.getByText('exam screen')).toBeInTheDocument();
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
    expect(await examCard()).toHaveTextContent('1 minute left');
  });

  it('shows the card in Portuguese', async () => {
    act(() => setLocale('pt'));
    await createExam(examIds, Date.now() - 30 * SECOND);
    renderHome();
    const card = await screen.findByRole('link', { name: new RegExp(MESSAGES.pt.home.examInProgress) });
    expect(card).toHaveTextContent(MESSAGES.pt.home.minutesLeft(30));
  });

  it('shows no card for an exam started 31 minutes ago, and counts its 20 questions as seen', async () => {
    const startedAt = Date.now() - 31 * MINUTE;
    const exam = await createExam(examIds, startedAt);
    const answered = examIds.slice(0, 12);
    await saveExamAnswers(exam.id, Object.fromEntries(answered.map((id) => [id, correctOf(id)])), startedAt + MINUTE);
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
    expect(screen.queryByText(en.home.minutesLeft(0))).not.toBeInTheDocument();
  });
});

describe('home messages', () => {
  it('has every English key in Portuguese', () => {
    const [enKeys, ptKeys] = (['en', 'pt'] satisfies Locale[]).map((l) => Object.keys(MESSAGES[l].home).sort());
    expect(ptKeys).toEqual(enKeys);
  });
});
