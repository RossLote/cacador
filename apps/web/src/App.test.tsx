import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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

/** Home's four buttons (D11); Flagged is reached from Settings and Progress. */
const HOME_BUTTONS = SCREENS.filter(([path]) => path !== '/flagged');

describe('routes', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    it(`shows Home with no back control (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.home.title);
      expect(screen.queryByRole('link', { name: t.common.backToHome })).not.toBeInTheDocument();
      for (const [path, screenKey] of HOME_BUTTONS) {
        expect(screen.getByRole('link', { name: t.common.nav[screenKey] })).toHaveAttribute('href', path);
      }
      expect(screen.queryByRole('link', { name: t.common.nav.flagged })).not.toBeInTheDocument();
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

  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    it(`says an unknown address names no screen, with the back control to Home (${locale})`, async () => {
      const t = MESSAGES[locale];
      act(() => setLocale(locale));
      renderAt('/flags');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.common.notFound.title);
      expect(screen.getByText(t.common.notFound.body)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('link', { name: t.common.backToHome }));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.home.title);
    });
  }

  it('has every English common key in Portuguese', () => {
    const keys = (value: object, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === 'object' && inner !== null ? keys(inner, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    expect(keys(MESSAGES.pt.common).sort()).toEqual(keys(MESSAGES.en.common).sort());
  });

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
