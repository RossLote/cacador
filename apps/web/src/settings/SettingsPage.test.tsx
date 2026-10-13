import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlaggedPage } from '@/flagged/FlaggedPage';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { drawExam, readiness, seededRandom } from '@/model';
import {
  clearProgress,
  closeStorage,
  createExam,
  exportFileName,
  exportProgress,
  finishExam,
  getStates,
  listAnswers,
  listExams,
  listFlags,
  LOCALE_KEY,
  recordAnswer,
  RECENT_KEY,
  saveExamAnswer,
  setFlag,
  storageMode,
  type ExportFile,
} from '@/storage';
import { withoutLogId } from '@/storage/state';
import { SettingsPage } from './SettingsPage';
import { correctOf, wrongOf } from '../../test/fixtures';

/** Makes the next progress file fail to build, as when storage cannot be read, then work again. */
const fileFaults = vi.hoisted(() => ({ failNext: false }));
vi.mock('./progressFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./progressFile')>();
  return {
    ...actual,
    makeProgressFile: (...args: Parameters<typeof actual.makeProgressFile>) => {
      if (!fileFaults.failNext) return actual.makeProgressFile(...args);
      fileFaults.failNext = false;
      return Promise.reject(new Error('storage read failed'));
    },
  };
});

afterEach(() => {
  fileFaults.failNext = false;
  vi.useRealTimers();
});

/** Stubs the anchor click and object URLs, and returns the names of the files downloaded. */
function catchDownloads(): string[] {
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:cacador/1'), revokeObjectURL: vi.fn() }));
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  return names;
}

const MINUTE = 60 * 1000;
const T0 = Date.UTC(2026, 9, 13, 9, 0);
const en = MESSAGES.en.settings;

/** Some progress: six practice answers, a finished exam (20 more answers) and two flags. */
async function makeProgress(): Promise<void> {
  for (const [i, id] of [3, 3, 40, 3, 112, 200].entries()) {
    const right = i % 2 === 0;
    await recordAnswer({ questionId: id, chosen: right ? correctOf(id) : wrongOf(id), correct: right, mode: 'practice', at: T0 + i * MINUTE });
  }
  const ids = drawExam(seededRandom(7));
  const exam = await createExam(ids, T0 + 10 * MINUTE);
  for (const id of ids.slice(0, 15)) await saveExamAnswer(exam.id, id, correctOf(id), T0 + 11 * MINUTE);
  await finishExam(exam.id, T0 + 20 * MINUTE);
  await setFlag(3, 'translation', 'says deer', T0 + 5 * MINUTE);
  await setFlag(40, 'hint', '', T0 + 6 * MINUTE);
}

/** Everything the device holds, as content (no export time). */
async function snapshot() {
  const { answers, exams, flags } = await exportProgress(T0);
  return { answers, exams, flags, states: await getStates() };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/flagged" element={<FlaggedPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const jsonFile = (text: string, name = 'cacador-progress-2026-10-13.json') => new File([text], name, { type: 'application/json' });

async function upload(text: string) {
  const user = userEvent.setup();
  renderPage();
  await user.upload(screen.getByLabelText(en.importFile), jsonFile(text));
  return user;
}

describe('Settings language', () => {
  it('switches the whole app to Portuguese, sets <html lang> and keeps the choice for the next visit', async () => {
    const user = userEvent.setup();
    renderPage();
    const english = screen.getByRole('button', { name: 'English' });
    const portuguese = screen.getByRole('button', { name: 'Português' });
    expect(english).toHaveAttribute('aria-pressed', 'true');
    expect(portuguese).toHaveAttribute('aria-pressed', 'false');
    expect(portuguese).toHaveAttribute('lang', 'pt-PT');

    await user.click(portuguese);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MESSAGES.pt.settings.title);
    expect(screen.getByRole('button', { name: MESSAGES.pt.settings.export })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Português' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('pt-PT');
    expect(localStorage.getItem(LOCALE_KEY)).toBe('pt');

    // A reload: the language store starts again from what was kept.
    vi.resetModules();
    const reloaded = await import('@/i18n/locale');
    expect(reloaded.getLocale()).toBe('pt');

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.title);
    expect(document.documentElement.lang).toBe('en-GB');
    expect(localStorage.getItem(LOCALE_KEY)).toBe('en');
  });
});

describe('Settings export', () => {
  it('downloads cacador-progress-<date>.json holding the device answers, exams and flags', async () => {
    await makeProgress();
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:cacador/1';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download });
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]).toEqual({ href: 'blob:cacador/1', download: exportFileName() });
    expect(exportFileName()).toMatch(/^cacador-progress-\d{4}-\d{2}-\d{2}\.json$/);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:cacador/1'));
    expect(document.querySelector('a[download]')).toBeNull();

    const file = JSON.parse(await blobs[0]!.text()) as ExportFile;
    expect([file.app, file.version]).toEqual(['cacador', 1]);
    expect(file.answers).toHaveLength(26);
    expect(file.answers).toEqual((await listAnswers()).map(withoutLogId));
    expect(file.exams).toEqual(await listExams());
    expect(file.flags).toEqual(expect.arrayContaining(await listFlags()));
    expect(file.flags).toHaveLength(2);
  });

  it('offers no Share where the browser cannot share a file', () => {
    vi.stubGlobal('navigator', Object.create(navigator, { canShare: { value: vi.fn(() => false) }, share: { value: vi.fn() } }));
    renderPage();
    expect(screen.queryByRole('button', { name: en.share })).not.toBeInTheDocument();
  });

  it('offers Share where the browser can share a file, and shares the export', async () => {
    await makeProgress();
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    vi.stubGlobal('navigator', Object.create(navigator, { canShare: { value: canShare }, share: { value: share } }));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: en.share }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files, title }] = share.mock.calls[0] as [{ files: File[]; title: string }];
    expect(title).toBe(en.shareTitle);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe(exportFileName());
    const file = JSON.parse(await files[0]!.text()) as ExportFile;
    expect([file.app, file.version, file.answers.length, file.exams.length, file.flags.length]).toEqual(['cacador', 1, 26, 1, 2]);
  });
});

describe('Settings export and share outcome', () => {
  it('clears a failed Export line once a retry works', async () => {
    const downloads = catchDownloads();
    const user = userEvent.setup();
    renderPage();

    fileFaults.failNext = true;
    await user.click(screen.getByRole('button', { name: en.export }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.failed));

    await user.click(screen.getByRole('button', { name: en.export }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('clears a failed Share line once a retry works', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(navigator, { canShare: { value: vi.fn(() => true) }, share: { value: share } }));
    const user = userEvent.setup();
    renderPage();

    fileFaults.failNext = true;
    await user.click(screen.getByRole('button', { name: en.share }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.failed));
    expect(share).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: en.share }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('shares what the device holds at the tap, dated that day, as Export does', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58));
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.create(navigator, { canShare: { value: vi.fn(() => true) }, share: { value: share } }));
    const downloads = catchDownloads();
    const user = userEvent.setup();
    renderPage();
    await act(async () => {
      await storageMode();
    });

    // An answer recorded in another tab after Settings opened, past midnight.
    vi.setSystemTime(new Date(2026, 9, 14, 0, 1));
    await recordAnswer({ questionId: 3, chosen: correctOf(3), correct: true, mode: 'practice', at: Date.now() });

    await user.click(screen.getByRole('button', { name: en.share }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files }] = share.mock.calls[0] as [{ files: File[] }];
    const shared = JSON.parse(await files[0]!.text()) as ExportFile;
    expect(files[0]!.name).toBe('cacador-progress-2026-10-14.json');
    expect(shared.answers).toHaveLength(1);
    expect(shared.exportedAt).toBe(Date.now());

    await user.click(screen.getByRole('button', { name: en.export }));
    await waitFor(() => expect(downloads).toEqual([files[0]!.name]));
  });
});

describe('Settings import', () => {
  it('restores the progress after Clear and reports the counts added', async () => {
    await makeProgress();
    const before = await snapshot();
    const text = JSON.stringify(await exportProgress());
    await clearProgress();
    expect(readiness(await getStates())).toMatchObject({ percent: 33, unseen: 506 });

    await upload(text);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added 26 answers, 1 exam and 2 flags'));
    expect(screen.getByRole('status')).toHaveTextContent(en.imported(26, 1, 2));
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(readiness(after.states)).toEqual(readiness(before.states));
  });

  it.each([
    ['text that is not JSON', 'not json at all'],
    ['JSON from another app', JSON.stringify({ app: 'other', version: 1, exportedAt: T0, answers: [], exams: [], flags: [] })],
    ['a later version', JSON.stringify({ app: 'cacador', version: 2, exportedAt: T0, answers: [], exams: [], flags: [] })],
    ['a malformed record', JSON.stringify({ app: 'cacador', version: 1, exportedAt: T0, answers: [{ questionId: 'x' }], exams: [], flags: [] })],
  ])('refuses %s and changes nothing', async (_name, text) => {
    await makeProgress();
    const before = await snapshot();

    await upload(text);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.importRefused));
    expect(await snapshot()).toEqual(before);
  });

  it('labels the file input and takes JSON files', () => {
    renderPage();
    const input = screen.getByLabelText(en.importFile);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/json,.json');
  });
});

describe('Settings clear progress', () => {
  it('asks first, clears only on confirm, empties the recent window and keeps the language', async () => {
    await makeProgress();
    localStorage.setItem(LOCALE_KEY, 'en');
    sessionStorage.setItem(RECENT_KEY, JSON.stringify([3, 40]));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Clear progress' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(en.clearTitle);
    await user.click(within(dialog).getByRole('button', { name: en.clearCancel }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await listAnswers()).toHaveLength(26);
    expect(sessionStorage.getItem(RECENT_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear progress' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: en.clearConfirm }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.cleared));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await listAnswers()).toEqual([]);
    expect(await listExams()).toEqual([]);
    expect(await listFlags()).toEqual([]);
    expect(readiness(await getStates())).toMatchObject({ percent: 33, unseen: 506 });
    expect(sessionStorage.getItem(RECENT_KEY)).toBeNull();
    expect(localStorage.getItem(LOCALE_KEY)).toBe('en');
  });
});

describe('Settings storage line', () => {
  it('says progress is not being saved when storage runs in memory', async () => {
    await closeStorage();
    vi.stubGlobal('indexedDB', undefined);
    renderPage();
    expect(await screen.findByText(en.notSaving)).toBeInTheDocument();
    expect(await storageMode()).toBe('memory');
  });

  it('says nothing about saving when IndexedDB is open', async () => {
    renderPage();
    await act(async () => {
      expect(await storageMode()).toBe('indexeddb');
    });
    expect(screen.queryByText(en.notSaving)).not.toBeInTheDocument();
  });
});

describe('Settings Flagged link', () => {
  it('opens /flagged', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('link', { name: en.flaggedLink }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MESSAGES.en.flagged.title);
  });
});

describe('settings messages', () => {
  it('has every English key in Portuguese', () => {
    const locales: Locale[] = ['en', 'pt'];
    const [enKeys, ptKeys] = locales.map((l) => Object.keys(MESSAGES[l].settings).sort());
    expect(ptKeys).toEqual(enKeys);
  });

  it('names the three counts, singular for one', () => {
    expect(en.imported(26, 2, 0)).toBe('Added 26 answers, 2 exams and 0 flags');
    expect(en.imported(1, 1, 1)).toBe('Added 1 answer, 1 exam and 1 flag');
    expect(MESSAGES.pt.settings.imported(1, 2, 3)).toBe('Adicionado: 1 resposta, 2 exames e 3 assinalações');
  });
});
