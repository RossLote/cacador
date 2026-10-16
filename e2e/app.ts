/** The pieces of the app the specs find by their words: the screen header, the tab bar, the question card and Practice's loop. */
import { questionById, type OptionKey, type Question } from '@cacador/data';
import { expect, type Locator, type Page } from '@playwright/test';

export const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C'];

export function questionFor(id: number): Question {
  const question = questionById(id);
  if (question === undefined) throw new Error(`no question ${id} in the bank`);
  return question;
}

export const wrongOf = (question: Question): OptionKey => OPTION_KEYS.find((key) => key !== question.answer) ?? 'A';

/**
 * The row every screen but Home opens with (DESIGN.md § 8.2): the back control, then the eyebrow over its line or, on
 * Progress, Settings, Flagged and not-found, the screen's title, then the right-hand slot.
 */
export const screenHeader = (page: Page): Locator => page.getByRole('main').locator('header').first();
export const tabBar = (page: Page): Locator => page.getByRole('navigation', { name: 'Main' });
export const tab = (page: Page, name: string): Locator => tabBar(page).getByRole('link', { name, exact: true });

/**
 * The question card on screen and the parts of it the bar talks about. Hold for English and Hint are looked up in
 * `scope`, not the card: Practice docks them over the tab bar, outside the card; a review card holds its own (cac-2tb).
 */
export function cardOf(scope: Page | Locator) {
  const card = scope.getByRole('article').first();
  const options = card.getByRole('group', { name: 'Options' }).getByRole('button');
  return {
    card,
    stem: card.locator(':scope > p[lang]'),
    options,
    option: (key: OptionKey) => options.nth(OPTION_KEYS.indexOf(key)),
    peek: scope.getByRole('button', { name: 'Hold for English', exact: true }),
    hint: scope.getByRole('button', { name: 'Hint', exact: true }),
    hintPanel: card.getByRole('region', { name: 'Hint' }),
  };
}

/** The id in Practice's screen header, "Question <id>", once a question is on screen. */
export async function shownId(page: Page): Promise<number> {
  const number = screenHeader(page).getByText(/^Question \d+$/);
  await expect(number).toBeVisible();
  return Number((await number.textContent())?.replace('Question ', ''));
}

/** Answers the practice question on screen with `key` and checks the result is revealed at once. */
export async function answerPractice(page: Page, key: OptionKey): Promise<number> {
  const id = await shownId(page);
  const question = questionFor(id);
  const { option } = cardOf(page);
  await option(key).click();
  await expect(option(key)).toHaveAttribute('data-mark', key === question.answer ? 'right' : 'wrong');
  await expect(option(question.answer)).toHaveAttribute('data-mark', key === question.answer ? 'right' : 'correct');
  return id;
}

export async function nextPractice(page: Page, previous: number): Promise<number> {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(screenHeader(page).getByText(/^Question \d+$/)).not.toHaveText(`Question ${previous}`);
  return shownId(page);
}
