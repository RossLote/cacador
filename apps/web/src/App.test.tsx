import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { setLocale } from './i18n/locale';
import type { Locale } from './i18n/locales';
import { MESSAGES } from './i18n/messages';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const SCREENS = [
  ['/practice', 'practice'],
  ['/exam', 'exam'],
  ['/progress', 'progress'],
  ['/settings', 'settings'],
  ['/flagged', 'flagged'],
] as const;

describe('routes', () => {
  afterEach(() => {
    act(() => setLocale('en'));
  });

  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    it(`shows Home with no back control (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.home.title);
      expect(screen.queryByRole('link', { name: t.common.backToHome })).not.toBeInTheDocument();
      for (const [path, screenKey] of SCREENS) {
        expect(screen.getByRole('link', { name: t.common.nav[screenKey] })).toHaveAttribute('href', path);
      }
    });

    for (const [path, screenKey] of SCREENS) {
      it(`shows the ${screenKey} placeholder at ${path} with the back control (${locale})`, () => {
        act(() => setLocale(locale));
        renderAt(path);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t[screenKey].title);
        expect(screen.getByRole('link', { name: t.common.backToHome })).toHaveAttribute('href', '/');
      });
    }
  }

  it('sends every exam sub-route to the exam folder', () => {
    renderAt('/exam/results/1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MESSAGES.en.exam.title);
  });

  it('returns to Home from the back control', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getByRole('link', { name: MESSAGES.en.common.backToHome }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MESSAGES.en.home.title);
  });
});
