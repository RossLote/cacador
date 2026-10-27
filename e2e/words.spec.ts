import { findPhrase, questionForWord, words, type OptionKey, type Word } from '@cacador/data';
import { expect, test, type Page } from '@playwright/test';
// A dependency-free leaf of the app: the storage keys are the app's own names.
import { LOCALE_KEY, WORDS_KEY } from '../apps/web/src/storage/keys';
import { boxOf, expectTabBar, OPTION_KEYS, roundCounter, screenHeader, seedRandom, shownWord, tab, TABS, wordCardOf } from './app';
import { expectFraunces, LIGHT } from './look';

/**
 * ACCEPTANCE BAR steps 2 to 9 (epic cac-zqe, the words drill), in order, in one fresh browser context at 390 px wide:
 * the words answered build on each other (1, 2, then 10, then 13). Step 10, offline, is offline.spec.ts.
 *
 * The words list is still growing while the drill ships, so nothing here pins it: every word and its English are read
 * from @cacador/data at run time by the Portuguese on screen. The pass and the options draw with Math.random, which
 * every page load replaces with the app's own seeded source, as round.spec.ts does.
 */
const SEED = 1;
const ROUND = 10;
const CARD = 'Words 10 terms from the bank · Portuguese to English';
const CARD_PT = 'Palavras 10 termos do banco · do português para o inglês';
/** Every English of the list, for the options in Portuguese (step 8). */
const ENGLISH = new Set(words.map((word) => word.en));

const eyebrow = (page: Page) => screenHeader(page).locator('.eyebrow');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const finish = (page: Page) => page.getByRole('button', { name: 'Finish', exact: true });

/** The letter of the option holding the word's English, or of one that does not, from the texts on screen. */
async function keyOf(page: Page, word: Word, right: boolean): Promise<OptionKey> {
  const texts = await wordCardOf(page).texts();
  const key = OPTION_KEYS.find((_, i) => (texts[i] === word.en) === right);
  if (key === undefined) throw new Error(`no ${right ? 'right' : 'wrong'} option for ${word.pt}: ${texts.join(', ')}`);
  return key;
}

/** Answers the word on screen with `key` and checks the rows are marked and locked at once. Whether it was right. */
async function answerWord(page: Page, word: Word, key: OptionKey): Promise<boolean> {
  await wordCardOf(page).option(key).click();
  return expectMarked(page, word, key);
}

/** The rows after answering `key`: the chosen one right or wrong, the word's own correct, all three locked. */
async function expectMarked(page: Page, word: Word, key: OptionKey): Promise<boolean> {
  const answer = await keyOf(page, word, true);
  const right = key === answer;
  const { option, options } = wordCardOf(page);
  await expect(option(key)).toHaveAttribute('data-mark', right ? 'right' : 'wrong');
  await expect(option(answer)).toHaveAttribute('data-mark', right ? 'right' : 'correct');
  for (const i of [0, 1, 2]) await expect(options.nth(i)).toBeDisabled();
  return right;
}

/** Opens the drill from Home's card, in English. */
async function openFromHome(page: Page) {
  await page.getByRole('main').getByRole('link', { name: CARD, exact: true }).click();
  await expect(page).toHaveURL(/\/cacador\/words$/);
}

test('words bar steps 2 to 9, in order, in one browser context', async ({ context, page }) => {
  test.setTimeout(180_000);
  await seedRandom(context, SEED);

  /** Every word answered so far, in the order shown. */
  const answered: Word[] = [];
  /** Whether each word of the first round was answered right, in the order shown. */
  const right: boolean[] = [];
  const unanswered = (word: Word) => expect(answered.map((seen) => seen.pt), 'a word not answered before').not.toContain(word.pt);

  await test.step('step 2: Home: main holds exactly four start cards: Quick 10 (rust, the width of the column) at the top; under it Words, the width of the column with the ink hairline, a link named exactly "Words 10 terms from the bank · Portuguese to English" to /cacador/words; under it Practice and Exam side by side', async () => {
    await page.goto('./');
    expect(await page.evaluate(() => Math.random.toString()), 'Math.random is the seeded source').not.toContain('[native code]');
    const main = page.getByRole('main');
    const cards = main.locator('[data-slot="start-card"]');
    await expect(cards).toHaveCount(4);
    const names = ['Quick 10 Weak ones first, then your score', CARD, 'Practice Weak ones first', 'Exam 20 questions · 30 min'];
    for (const [i, name] of names.entries()) await expect(cards.nth(i)).toHaveAccessibleName(name);
    const [quick, wordsCard, practice, exam] = [cards.nth(0), cards.nth(1), cards.nth(2), cards.nth(3)];

    await expect(quick).toHaveCSS('background-color', LIGHT.rust);
    await expect(wordsCard).toHaveAttribute('href', '/cacador/words');
    await expect(wordsCard).not.toHaveCSS('background-color', LIGHT.rust);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      await expect(wordsCard).toHaveCSS(`border-${side}-color`, LIGHT.ink);
      await expect(wordsCard).toHaveCSS(`border-${side}-width`, '1px');
    }

    const [quickBox, wordsBox, practiceBox, examBox] = await Promise.all([boxOf(quick), boxOf(wordsCard), boxOf(practice), boxOf(exam)]);
    // Quick 10 and Words take the column's width; Practice and Exam share the row under them.
    expect(Math.abs(wordsBox.width - quickBox.width), 'Words is the width of Quick 10').toBeLessThanOrEqual(1);
    expect(Math.abs(wordsBox.x - quickBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(practiceBox.x - quickBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(examBox.x + examBox.width - (quickBox.x + quickBox.width))).toBeLessThanOrEqual(1);
    expect(wordsBox.y, 'Words is under Quick 10').toBeGreaterThan(quickBox.y + quickBox.height - 1);
    expect(practiceBox.y, 'Practice is under Words').toBeGreaterThan(wordsBox.y + wordsBox.height - 1);
    expect(Math.abs(examBox.y - practiceBox.y), 'Exam beside Practice').toBeLessThanOrEqual(1);
    expect(examBox.x).toBeGreaterThan(practiceBox.x + practiceBox.width - 1);
  });

  await test.step('step 3: the Words card: the address is /cacador/words; the screen header has "Back to Home", the eyebrow "Words" and "1 of 10" in Fraunces at the right; the tab bar shows its four tabs with none current; the word in Fraunces with its phrase under it, both a list entry\'s; exactly 3 options lettered A, B, C, each the English of a word of the entry\'s kind, exactly one the entry\'s en; no "Hold for English" and no "Hint"', async () => {
    await openFromHome(page);
    const header = screenHeader(page);
    await expect(header.getByRole('link', { name: 'Back to Home', exact: true })).toBeVisible();
    await expect(eyebrow(page)).toHaveText('Words');
    await expect(roundCounter(page)).toHaveText(`1 of ${ROUND}`);
    await expectFraunces(page, roundCounter(page));
    const headerBox = await boxOf(header);
    const counterBox = await boxOf(roundCounter(page));
    expect(counterBox.x, 'the counter is right of the eyebrow').toBeGreaterThan((await boxOf(eyebrow(page))).x);
    expect(headerBox.x + headerBox.width - (counterBox.x + counterBox.width), 'the counter ends the row').toBeLessThanOrEqual(4);
    await expectTabBar(page, TABS);

    const shown = await shownWord(page);
    const { word, phrase, options } = wordCardOf(page);
    await expectFraunces(page, word);
    await expect(word).toHaveAttribute('lang', 'pt-PT');
    await expect(phrase).toHaveAttribute('lang', 'pt-PT');
    const wordBox = await boxOf(word);
    expect((await boxOf(phrase)).y, 'the phrase is under the word').toBeGreaterThanOrEqual(wordBox.y + wordBox.height - 1);

    await expect(options).toHaveCount(3);
    for (const [i, key] of OPTION_KEYS.entries()) {
      await expect(options.nth(i).locator('[aria-hidden="true"]').first()).toHaveText(key);
      await expect(options.nth(i)).toHaveAccessibleName(new RegExp(`^${key}\\. `));
    }
    const texts = await wordCardOf(page).texts();
    const ofKind = new Set(words.filter((entry) => entry.kind === shown.kind).map((entry) => entry.en));
    for (const text of texts) expect(ofKind, `"${text}" is the English of a ${shown.kind} word`).toContain(text);
    expect(texts.filter((text) => text === shown.en), 'exactly one option is the word\'s English').toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Hold for English', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
  });

  await test.step('step 4: a wrong option: that row reads "Wrong", the right one "Right", the options are locked; the panel shows "Question N", N the first of the entry\'s ids whose text holds the phrase, over a sentence containing the phrase, and the entry\'s note when it has one; Next shows "2 of 10" with another word', async () => {
    const shown = await shownWord(page);
    const key = await keyOf(page, shown, false);
    right.push(await answerWord(page, shown, key));
    answered.push(shown);
    const { option, panel } = wordCardOf(page);
    await expect(option(key)).toContainText('Wrong');
    await expect(option(await keyOf(page, shown, true))).toContainText('Right');

    const question = questionForWord(shown);
    expect(question, `a question of ${shown.pt} holds its phrase`).toBeDefined();
    await expect(panel).toHaveAccessibleName(`Question ${question?.id}`);
    const sentence = (await panel.locator('p[lang="pt-PT"]').textContent()) ?? '';
    expect(findPhrase(sentence, shown.phrase), `the sentence "${sentence}" holds "${shown.phrase}"`).not.toBe(-1);
    const note = panel.locator('p[lang="en"]');
    if (shown.note) await expect(note).toHaveText(shown.note);
    else await expect(note).toHaveCount(0);

    await expect(finish(page)).toHaveCount(0);
    await next(page).click();
    await expect(roundCounter(page)).toHaveText(`2 of ${ROUND}`);
    unanswered(await shownWord(page));
  });

  await test.step('step 5: keys: on word 2, pressing 2 marks the second option; Enter shows "3 of 10"', async () => {
    const shown = await shownWord(page);
    await page.keyboard.press('2');
    right.push(await expectMarked(page, shown, 'B'));
    answered.push(shown);
    await expect(wordCardOf(page).option('B')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(roundCounter(page)).toHaveText(`3 of ${ROUND}`);
  });

  await test.step('step 6: words 3 to 10 answered, every third right by the list: the tenth answer\'s button reads Finish and there is no Next; Finish shows the region "Round done" with the count right R in Fraunces and "R of 10 right", exactly 10 rows each a word\'s Portuguese and English in the order shown, exactly 10 − R marked "Missed", and a rust "Another 10"; the header reads "10 of 10"', async () => {
    for (let n = 3; n <= ROUND; n++) {
      await expect(roundCounter(page)).toHaveText(`${n} of ${ROUND}`);
      const shown = await shownWord(page);
      unanswered(shown);
      right.push(await answerWord(page, shown, await keyOf(page, shown, n % 3 === 0)));
      answered.push(shown);
      if (n < ROUND) {
        await expect(finish(page)).toHaveCount(0);
        await next(page).click();
      } else {
        await expect(next(page)).toHaveCount(0);
        await finish(page).click();
      }
    }
    const score = right.filter(Boolean).length;

    const plate = page.getByRole('region', { name: 'Round done' });
    await expect(plate).toBeVisible();
    await expectFraunces(page, plate.getByText(String(score), { exact: true }));
    await expect(plate).toContainText(`${score} of ${ROUND} right`);
    const rows = plate.getByRole('listitem');
    await expect(rows).toHaveCount(ROUND);
    for (const [i, word] of answered.entries()) {
      const row = rows.nth(i);
      await expect(row.locator('[lang="pt-PT"]')).toHaveText(word.pt);
      await expect(row.locator('[lang="en"]')).toHaveText(word.en);
      if (right[i]) await expect(row).not.toContainText('Missed');
      else await expect(row).toContainText('Missed');
    }
    await expect(rows.filter({ hasText: 'Missed' })).toHaveCount(ROUND - score);
    await expect(plate.getByRole('button', { name: `Another ${ROUND}`, exact: true })).toHaveCSS('background-color', LIGHT.rust);
    await expect(roundCounter(page)).toHaveText(`${ROUND} of ${ROUND}`);
  });

  await test.step('step 7: Another 10: "1 of 10"; three words answered; then the Home tab, the Words card, and a reload of the page: each time the word shown is none of the 13 answered so far, and those 13 are 13 different words', async () => {
    await page.getByRole('region', { name: 'Round done' }).getByRole('button', { name: `Another ${ROUND}`, exact: true }).click();
    await expect(roundCounter(page)).toHaveText(`1 of ${ROUND}`);
    for (let n = 1; n <= 3; n++) {
      await expect(roundCounter(page)).toHaveText(`${n} of ${ROUND}`);
      const shown = await shownWord(page);
      unanswered(shown);
      await answerWord(page, shown, await keyOf(page, shown, false));
      answered.push(shown);
      if (n < 3) await next(page).click();
    }
    expect(new Set(answered.map((word) => word.pt)).size, '13 different words').toBe(13);

    await tab(page, 'Home').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Caçador' })).toBeVisible();
    await openFromHome(page);
    unanswered(await shownWord(page));
    await page.reload();
    await expect(roundCounter(page)).toBeVisible();
    unanswered(await shownWord(page));
  });

  await test.step('step 8: Settings, Português: Home\'s card and the screen\'s own words are Portuguese (the eyebrow "Palavras", the counter "1 de 10"), the word and phrase still Portuguese and every option still an English en of the list; English brings them back', async () => {
    await tab(page, 'Home').click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();

    const cardPt = page.getByRole('main').getByRole('link', { name: CARD_PT, exact: true });
    await expect(cardPt).toHaveAttribute('href', '/cacador/words');
    await cardPt.click();
    await expect(eyebrow(page)).toHaveText('Palavras');
    await expect(roundCounter(page)).toHaveText(`1 de ${ROUND}`);
    const { word, phrase, options, texts } = wordCardOf(page, 'Opções');
    await expect(word).toHaveAttribute('lang', 'pt-PT');
    await expect(phrase).toHaveAttribute('lang', 'pt-PT');
    await shownWord(page);
    await expect(options).toHaveCount(3);
    for (const i of [0, 1, 2]) await expect(options.nth(i).locator('[lang]')).toHaveAttribute('lang', 'en');
    for (const text of await texts()) expect(ENGLISH, `"${text}" is an English of the list`).toContain(text);

    await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();
    await page.getByRole('link', { name: 'Definições', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
    await openFromHome(page);
    await expect(eyebrow(page)).toHaveText('Words');
    await expect(roundCounter(page)).toHaveText(`1 of ${ROUND}`);
    await expect(wordCardOf(page).options).toHaveCount(3);
  });

  await test.step('step 9: Settings, Clear progress, confirmed: localStorage holds no cacador.words and still holds cacador.locale; Words opens at "1 of 10" with a word and three options', async () => {
    const stored = (key: string) => page.evaluate((name) => localStorage.getItem(name), key);
    expect(await stored(WORDS_KEY), 'the pass is kept before the clear').not.toBeNull();
    await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Clear progress' }).click();
    await page.getByRole('alertdialog', { name: 'Clear all progress?' }).getByRole('button', { name: 'Clear everything' }).click();
    await expect(page.getByRole('status')).toHaveText('Progress cleared');
    expect(await stored(WORDS_KEY)).toBeNull();
    expect(await stored(LOCALE_KEY)).not.toBeNull();

    await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
    await openFromHome(page);
    await expect(roundCounter(page)).toHaveText(`1 of ${ROUND}`);
    await shownWord(page);
    await expect(wordCardOf(page).options).toHaveCount(3);
  });
});
