import { act, render, screen, within } from '@testing-library/react';
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

/**
 * Home's links inside main (epic cac-8cn D5, D7): the header's Settings control, named
 * exactly the nav word, and the two cards, named by their title and line, so an exact
 * Practice or Exam query finds the tab only. Progress is the tab's; Flagged is reached
 * from Settings and Progress.
 */
const HOME_BUTTONS = (t: Messages) =>
  [
    ['/settings', t.common.nav.settings],
    ['/practice', `${t.common.nav.practice} ${t.home.practiceLine}`],
    ['/exam', `${t.common.nav.exam} ${t.home.examLine(20, 30)}`],
  ] as const;

describe('routes', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale];

    it(`shows Home with no back control (${locale})`, () => {
      act(() => setLocale(locale));
      renderAt('/');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.home.title);
      expect(screen.queryByRole('link', { name: t.common.backToHome })).not.toBeInTheDocument();
      const main = screen.getByRole('main');
      for (const [path, name] of HOME_BUTTONS(t)) {
        expect(within(main).getByRole('link', { name })).toHaveAttribute('href', path);
      }
      expect(within(main).queryByRole('link', { name: t.common.nav.practice })).not.toBeInTheDocument();
      expect(within(main).queryByRole('link', { name: t.common.nav.exam })).not.toBeInTheDocument();
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

type Messages = (typeof MESSAGES)[Locale];

/** Every route the bar shows on, with the tab its screen makes current: none on results, Settings, Flagged and not-found (D5). */
const TAB_BAR_ROUTES: readonly (readonly [string, keyof Messages['common']['nav'] | undefined])[] = [
  ['/', 'home'],
  ['/practice', 'practice'],
  ['/practice?topic=patos', 'practice'],
  ['/Practice', 'practice'],
  ['/progress', 'progress'],
  ['/PROGRESS/', 'progress'],
  ['/settings', undefined],
  ['/flagged', undefined],
  ['/exam/results/1', undefined],
  ['/flags', undefined],
  ['/exam/nowhere', undefined],
];

/** Every route but Home, with the eyebrow its header opens with: the screen's name (D6). */
const HEADER_ROUTES: readonly (readonly [string, (t: Messages) => string])[] = [
  ['/practice', (t) => t.common.nav.practice],
  ['/exam', (t) => t.common.nav.exam],
  ['/exam/results/1', (t) => t.common.nav.exam],
  ['/progress', (t) => t.common.nav.progress],
  ['/settings', (t) => t.common.nav.settings],
  ['/flagged', (t) => t.common.nav.flagged],
  ['/flags', (t) => t.common.notFound.title],
  ['/exam/nowhere', (t) => t.common.notFound.title],
];

const TABS = ['home', 'practice', 'exam', 'progress'] as const;
const en = MESSAGES.en;

const tabBar = (t: Messages) => screen.queryByRole('navigation', { name: t.common.mainNav });
const tabLinks = (t: Messages) => within(screen.getByRole('navigation', { name: t.common.mainNav })).getAllByRole('link');

describe('the shell (DESIGN.md § 6.3, § 8.2, epic cac-8cn D5, D6)', () => {
  for (const [path, current] of TAB_BAR_ROUTES) {
    it(`shows the tab bar at ${path}, outside main, with ${current ?? 'no'} tab current`, () => {
      const t = MESSAGES.en;
      renderAt(path);
      const links = tabLinks(t);
      expect(links.map((link) => link.textContent)).toEqual(['Home', 'Practice', 'Exam', 'Progress']);
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/practice', '/exam', '/progress']);
      TABS.forEach((key, index) => {
        const link = links[index] as HTMLElement;
        expect(link).toHaveAccessibleName(t.common.nav[key]);
        if (key === current) expect(link).toHaveAttribute('aria-current', 'page');
        else expect(link).not.toHaveAttribute('aria-current');
      });
      expect(screen.getByRole('main')).not.toContainElement(tabBar(t));
    });
  }

  // The router matches paths regardless of case, so /Exam is the running exam as well (cac-8cn.12).
  for (const path of ['/exam', '/exam/', '/Exam', '/EXAM/']) {
    it(`shows no tab bar at ${path}, only the back control`, () => {
      renderAt(path);
      expect(tabBar(MESSAGES.en)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: MESSAGES.en.common.backToHome })).toHaveAttribute('href', '/');
    });
  }

  for (const [path, eyebrow] of HEADER_ROUTES) {
    it(`opens the main content at ${path} with the back control, then the screen's name`, () => {
      const t = MESSAGES.en;
      renderAt(path);
      const main = screen.getByRole('main');
      const back = within(main).getAllByRole('link')[0] as HTMLElement;
      expect(back).toHaveAccessibleName(t.common.backToHome);
      expect(back).toHaveAttribute('href', '/');
      expect(back).toHaveClass('size-11');
      expect(back.querySelector('svg')).toHaveClass('lucide-arrow-left');
      const header = back.closest('header') as HTMLElement;
      expect(main.firstElementChild?.firstElementChild).toBe(header);
      expect(header).toHaveTextContent(eyebrow(t));
      expect(screen.getAllByRole('link', { name: t.common.backToHome })).toHaveLength(1);
    });
  }

  it('shows no back control and no screen header on Home', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: MESSAGES.en.common.backToHome })).not.toBeInTheDocument();
    expect(screen.getByRole('main').querySelector('header')).toBeNull();
  });

  it('follows the language switch in the tab labels, the bar\'s name and the back control', () => {
    act(() => setLocale('pt'));
    renderAt('/settings');
    expect(tabLinks(MESSAGES.pt).map((link) => link.textContent)).toEqual(['Início', 'Praticar', 'Exame', 'Progresso']);
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    act(() => setLocale('en'));
    expect(tabLinks(MESSAGES.en).map((link) => link.textContent)).toEqual(['Home', 'Practice', 'Exam', 'Progress']);
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });

  it('moves the current tab as the tabs are followed', async () => {
    const t = MESSAGES.en;
    renderAt('/');
    await userEvent.click(within(tabBar(t) as HTMLElement).getByRole('link', { name: t.common.nav.progress }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.progress.title);
    expect(tabLinks(t).filter((link) => link.hasAttribute('aria-current')).map((link) => link.textContent)).toEqual([
      'Progress',
    ]);
    await userEvent.click(within(tabBar(t) as HTMLElement).getByRole('link', { name: t.common.nav.exam }));
    expect(tabBar(t)).not.toBeInTheDocument();
  });

  it('draws the tab icons, the current one too, and the Flagged row at the one stroke of 1.75 (DESIGN.md § 8.5)', () => {
    renderAt('/settings');
    const icons = [...(tabBar(en) as HTMLElement).querySelectorAll('svg'), ...screen.getByRole('link', { name: en.settings.flaggedLink }).querySelectorAll('svg')];
    expect(icons).toHaveLength(6);
    for (const icon of icons) expect(icon).toHaveAttribute('stroke-width', '1.75');
  });

  it('gives the language chips the 6 px chip corners (D4)', () => {
    renderAt('/settings');
    const chips = within(screen.getByRole('group', { name: en.settings.language })).getAllByRole('button');
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip).toHaveClass('rounded-sm');
      expect(chip).not.toHaveClass('rounded-md');
    }
  });

  it('pads the bar and the column by fixed amounts, with no safe-area term the viewport never sets', () => {
    renderAt('/');
    expect(tabBar(en)).toHaveClass('py-2.5');
    expect(screen.getByRole('main')).toHaveClass('pb-26');
  });

  /** Option `index` (0 is A) of the question on screen, once one is. */
  const option = async (index: number) =>
    within(await screen.findByRole('group', { name: en.practice.card.options })).getAllByRole('button')[index] as HTMLElement;
  const practiceTab = () => within(tabBar(en) as HTMLElement).getByRole('link', { name: en.common.nav.practice });

  it('lets go of the focus when a tab is tapped, so the laptop keys answer on Practice at once', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(practiceTab());
    expect(document.activeElement).toBe(document.body);
    expect(await option(0)).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard('1');
    expect(await option(0)).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets go of the focus when the current tab is tapped again, so the keys still answer', async () => {
    const user = userEvent.setup();
    renderAt('/practice');
    expect(await option(0)).toHaveAttribute('aria-pressed', 'false');
    await user.click(practiceTab());
    expect(practiceTab()).toHaveAttribute('aria-current', 'page');
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('a');
    expect(await option(0)).toHaveAttribute('aria-pressed', 'true');
  });
});
