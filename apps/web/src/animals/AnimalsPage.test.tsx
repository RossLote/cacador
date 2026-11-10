import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';

/** The app at `path`, so the /animals/* route in App.tsx is proved along with this folder's sub-routes. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const h1 = () => screen.getByRole('heading', { level: 1 });

describe('AnimalsPage (D21)', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    /** The screen header's back control to Home, and the tab bar with no tab current. */
    const expectFrame = () => {
      expect(screen.getByRole('link', { name: t.common.backToHome })).toHaveAttribute('href', '/');
      const nav = screen.getByRole('navigation', { name: t.common.mainNav });
      for (const link of within(nav).getAllByRole('link')) expect(link).not.toHaveAttribute('aria-current');
    };

    it(`opens /animals on the grid, titled ${t.animals.title} (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/animals');
      expect(h1()).toHaveTextContent(t.animals.title);
      expect(h1()).toHaveClass('font-heading');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expectFrame();
    });

    it(`opens /animals/credits on the photo credits, titled ${t.animals.credits} (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/animals/credits');
      expect(h1()).toHaveTextContent(t.animals.credits);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expectFrame();
    });

    it(`opens /animals/javali on the pass, its eyebrow and screen-reader heading ${t.animals.title} (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/animals/javali');
      expect(screen.getByText(t.animals.title, { selector: 'p.eyebrow' })).toBeInTheDocument();
      expect(h1()).toHaveTextContent(t.animals.title);
      expect(h1()).toHaveClass('sr-only');
      expect(screen.queryByRole('heading', { name: t.common.notFound.title })).not.toBeInTheDocument();
      expectFrame();
    });

    for (const path of ['/animals/nope', '/animals/javali/x']) {
      it(`shows the not-found page at ${path} (${locale})`, () => {
        act(() => setLocale(locale));
        renderAt(path);
        expect(h1()).toHaveTextContent(t.common.notFound.title);
        expect(screen.getByText(t.common.notFound.body)).toBeInTheDocument();
        expect(screen.queryByText(t.animals.title)).not.toBeInTheDocument();
        expectFrame();
      });
    }
  }
});
