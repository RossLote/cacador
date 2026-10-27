/**
 * The pieces of the app the specs find by their words: the screen header, the tab bar, the question card, Practice's
 * loop and the words drill's card.
 */
import { questionById, words, type OptionKey, type Question, type Word } from '@cacador/data';
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
// A dependency-free leaf of the app's model, serialised into the page.
import { seededRandom } from '../apps/web/src/model/random';

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

export const TABS = ['Home', 'Practice', 'Exam', 'Progress'];

/** Every page the context loads draws with the app's own seeded source in place of Math.random, so a run replays. */
export async function seedRandom(context: BrowserContext, seed: number) {
  await context.addInitScript({ content: `Math.random = (${seededRandom.toString()})(${seed});` });
}

/** A round's counter in the screen header's right-hand slot, "3 of 10" (or "3 de 10" in Portuguese). */
export const roundCounter = (page: Page): Locator => screenHeader(page).getByText(/^\d+ (of|de) \d+$/);

/** The tab bar holds the four tabs by these names, `current` alone marked as the page (none when undefined). */
export async function expectTabBar(page: Page, names: readonly string[], current?: string) {
  const links = tabBar(page).getByRole('link');
  await expect(links).toHaveText([...names]);
  for (const name of names) {
    const link = tab(page, name);
    if (name === current) await expect(link).toHaveAttribute('aria-current', 'page');
    else await expect(link).not.toHaveAttribute('aria-current');
  }
}

/** Where a locator is drawn; it must be. */
export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`not drawn: ${locator.toString()}`);
  return box;
}

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

/** The entry of the words list (@cacador/data) whose Portuguese is `pt`. */
function wordFor(pt: string): Word {
  const word = words.find((entry) => entry.pt === pt);
  if (word === undefined) throw new Error(`no word ${pt} in the list`);
  return word;
}

/**
 * The words drill's card on screen (DESIGN.md § 6.11, epic cac-zqe): the Portuguese word and its phrase under it, the
 * group of three English options (named "Options", or `optionsName` in another interface language) and the panel the
 * answer opens, a region named "Question N".
 */
export function wordCardOf(page: Page, optionsName = 'Options') {
  const card = page.getByRole('article');
  const portuguese = card.locator(':scope > div > p[lang="pt-PT"]');
  const options = card.getByRole('group', { name: optionsName, exact: true }).getByRole('button');
  return {
    word: portuguese.first(),
    phrase: portuguese.nth(1),
    options,
    option: (key: OptionKey) => options.nth(OPTION_KEYS.indexOf(key)),
    /** Each option's English, A to C. */
    texts: () => options.locator('[lang="en"]').allTextContents(),
    panel: card.getByRole('region', { name: /^Question \d+$/ }),
  };
}

/** The word on screen as its list entry, once its word and phrase are shown: both are the entry's. */
export async function shownWord(page: Page): Promise<Word> {
  const { word, phrase } = wordCardOf(page);
  await expect(word).toBeVisible();
  const entry = wordFor((await word.textContent()) ?? '');
  await expect(phrase).toHaveText(entry.phrase);
  return entry;
}
