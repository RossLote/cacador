import { questionById } from '@cacador/data';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { localDateKey } from '@/model';
import { getFlags, setFlag } from '@/storage';
import { formatFlagLine, formatFlags } from './copyFormat';
import { FlaggedPage } from './FlaggedPage';

/** Makes the storage module's removeFlag reject, as when IndexedDB aborts a write, while reads still work. */
const storageFaults = vi.hoisted(() => ({ removeFlag: false }));
vi.mock('@/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/storage')>();
  return {
    ...actual,
    removeFlag: (...args: Parameters<typeof actual.removeFlag>) =>
      storageFaults.removeFlag ? Promise.reject(new Error('transaction aborted')) : actual.removeFlag(...args),
  };
});

afterEach(() => {
  storageFaults.removeFlag = false;
});

const T0 = Date.UTC(2026, 9, 13, 9, 0);
const en = MESSAGES.en.flagged;

function renderPage() {
  return render(
    <MemoryRouter>
      <FlaggedPage />
    </MemoryRouter>,
  );
}

const stem = (id: number) => {
  const q = questionById(id);
  if (!q) throw new Error(`no question ${id}`);
  return q.question;
};

describe('Flagged page', () => {
  it('lists the flags newest first with id, kind, note and Portuguese stem', async () => {
    await setFlag(12, 'translation', 'wrong species name', T0);
    await setFlag(30, 'hint', '', T0 + 1000);
    renderPage();

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(en.questionNumber(30));
    expect(rows[0]).toHaveTextContent(en.kindHint);
    expect(rows[0]).toHaveTextContent(en.noNote);
    expect(rows[0]).toHaveTextContent(stem(30));
    expect(rows[1]).toHaveTextContent(en.questionNumber(12));
    expect(rows[1]).toHaveTextContent(en.kindEnglish);
    expect(rows[1]).toHaveTextContent('wrong species name');
    expect(rows[1]).toHaveTextContent(stem(12));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.title);
  });

  it('draws each row as a card with the number in Fraunces, the kind as a chip and a Clear button', async () => {
    await setFlag(12, 'translation', 'wrong species name', T0);
    renderPage();
    const [row] = await screen.findAllByRole('listitem');
    if (!row) throw new Error('no row');
    expect(within(row).getByText(en.questionNumber(12))).toHaveClass('font-heading');
    expect(within(row).getByText(en.kindEnglish)).toHaveAttribute('data-slot', 'badge');
    expect(within(row).getByText(stem(12))).toHaveClass('text-muted-foreground');
    expect(within(row).getByRole('button', { name: en.clearLabel(12, en.kindEnglish) })).toHaveTextContent(en.clear);
    expect(row.firstElementChild).toHaveClass('bg-card', 'border-line');
  });

  it('draws Copy as the rust fill with Share beside it as the ink hairline', async () => {
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share: vi.fn() }));
    await setFlag(12, 'translation', 'x', T0);
    renderPage();
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('button', { name: en.copy })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: en.share })).toHaveClass('border-ink');
    vi.unstubAllGlobals();
  });

  it('shows the row labels in Portuguese when the UI language is Portuguese', async () => {
    const pt = MESSAGES.pt.flagged;
    act(() => setLocale('pt'));
    await setFlag(12, 'translation', 'x', T0);
    renderPage();
    const [row] = await screen.findAllByRole('listitem');
    expect(row).toHaveTextContent(pt.questionNumber(12));
    expect(row).toHaveTextContent(pt.kindEnglish);
  });

  it('copies the header and one line per flag, in English even in a Portuguese UI', async () => {
    const user = userEvent.setup();
    act(() => setLocale('pt'));
    await setFlag(12, 'translation', 'wrong species name', T0);
    await setFlag(30, 'hint', '', T0 + 1000);
    renderPage();
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: MESSAGES.pt.flagged.copy }));

    const copied = await navigator.clipboard.readText();
    expect(copied.split('\n')).toEqual([`Caçador flags ${localDateKey(Date.now())}`, '#30 Hint', '#12 English: wrong species name']);
    expect(await screen.findByRole('status')).toHaveTextContent(MESSAGES.pt.flagged.copied);
  });

  it('clears one flag and leaves the other', async () => {
    const user = userEvent.setup();
    await setFlag(12, 'translation', 'a', T0);
    await setFlag(30, 'hint', 'b', T0 + 1000);
    renderPage();
    const rows = await screen.findAllByRole('listitem');

    await user.click(within(rows[0]!).getByRole('button', { name: en.clearLabel(30, en.kindHint) }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByRole('listitem')).toHaveTextContent(en.questionNumber(12));
    expect(await getFlags(30)).toEqual([]);
    expect(await getFlags(12)).toHaveLength(1);
  });

  it('says so when a clear fails although the list still reads', async () => {
    const user = userEvent.setup();
    await setFlag(12, 'translation', 'a', T0);
    renderPage();
    storageFaults.removeFlag = true;

    await user.click(await screen.findByRole('button', { name: en.clearLabel(12, en.kindEnglish) }));

    expect(await screen.findByText(en.loadFailed)).toBeInTheDocument();
    expect(await getFlags(12)).toHaveLength(1);
  });

  it('dates the copied header on the day of the tap, not of the last render', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const beforeMidnight = new Date(2026, 9, 13, 23, 58).getTime();
    const afterMidnight = new Date(2026, 9, 14, 0, 1).getTime();
    vi.setSystemTime(beforeMidnight);
    const user = userEvent.setup();
    await setFlag(12, 'translation', '', T0);
    renderPage();
    await screen.findAllByRole('listitem');

    vi.setSystemTime(afterMidnight);
    await user.click(screen.getByRole('button', { name: en.copy }));

    expect((await navigator.clipboard.readText()).split('\n')[0]).toBe('Caçador flags 2026-10-14');
  });

  it('counts flags, not questions, in its Portuguese empty line', async () => {
    act(() => setLocale('pt'));
    renderPage();
    expect(await screen.findByText(MESSAGES.pt.flagged.empty)).toBeInTheDocument();
    expect(MESSAGES.pt.flagged.empty).toMatch(/^Nenhuma assinalação\./);
  });

  it('says there are no flags and disables Copy when the list is empty', async () => {
    renderPage();
    expect(await screen.findByText(en.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.copy })).toBeDisabled();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('disables Copy once the last flag is cleared', async () => {
    const user = userEvent.setup();
    await setFlag(12, 'translation', '', T0);
    renderPage();
    await user.click(await screen.findByRole('button', { name: en.clearLabel(12, en.kindEnglish) }));
    expect(await screen.findByText(en.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.copy })).toBeDisabled();
  });

  describe('Share', () => {
    it('is absent where navigator.share is undefined', async () => {
      vi.stubGlobal('navigator', Object.create(navigator, { share: { value: undefined } }));
      await setFlag(12, 'translation', '', T0);
      renderPage();
      await screen.findAllByRole('listitem');
      expect(screen.queryByRole('button', { name: en.share })).not.toBeInTheDocument();
    });

    it('is present where it exists and shares the same text', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', Object.create(navigator, { share: { value: share } }));
      const user = userEvent.setup();
      await setFlag(12, 'translation', 'n', T0);
      renderPage();
      await screen.findAllByRole('listitem');

      await user.click(screen.getByRole('button', { name: en.share }));

      expect(share).toHaveBeenCalledWith({ text: formatFlags([{ questionId: 12, kind: 'translation', note: 'n', at: T0 }]) });
    });
  });
});

describe('copy format', () => {
  it('omits the colon when the note is empty or blank', () => {
    expect(formatFlagLine({ questionId: 7, kind: 'translation', note: '', at: T0 })).toBe('#7 English');
    expect(formatFlagLine({ questionId: 7, kind: 'hint', note: '  ', at: T0 })).toBe('#7 Hint');
    expect(formatFlagLine({ questionId: 7, kind: 'hint', note: 'too long', at: T0 })).toBe('#7 Hint: too long');
  });

  it('puts the local date in the header', () => {
    expect(formatFlags([], T0)).toBe(`Caçador flags ${localDateKey(T0)}`);
  });
});

describe('flagged messages', () => {
  it('has every English key in Portuguese', () => {
    const locales: Locale[] = ['en', 'pt'];
    const [enKeys, ptKeys] = locales.map((l) => Object.keys(MESSAGES[l].flagged).sort());
    expect(ptKeys).toEqual(enKeys);
  });
});
