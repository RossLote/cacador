import { animalBySlug, animals, type Animal } from '@cacador/data';
import { expect, test, type Page } from '@playwright/test';
// A dependency-free leaf of the app: the storage keys are the app's own names.
import { ANIMALS_KEY } from '../apps/web/src/storage/keys';
import {
  animalTileOf,
  animalTiles,
  answerPractice,
  boxOf,
  cardOf,
  expectPhotosLoaded,
  expectStartCards,
  expectTabBar,
  nextPractice,
  questionFor,
  roundCounter,
  screenHeader,
  shownId,
  startCards,
  tab,
  TABS,
  wrongOf,
} from './app';
import { expectFraunces, LIGHT } from './look';

/**
 * Animal practice (planning/animal-practice, D1 to D23), in order, in one fresh browser context at 390 px wide: Home's
 * Animals card, the grid of 19 photo tiles, the boar's pass left partway, carried on across Home and a reload and
 * finished, Missed ones only, the mouflon all wrong, Photo credits, Português and Clear progress. The steps build on
 * each other: the boar's and the mouflon's scores are the tiles' chips later on.
 *
 * Every animal, its names, its credit and its questions are read from @cacador/data at run time; the answers are the
 * bank's key. A pass asks the questions in the bank's order (D9), so nothing here draws at random.
 */
const CARD = 'Animals One animal at a time · every question about it';
const CARD_PT = 'Animais Um animal de cada vez · todas as perguntas sobre ele';

function animalFor(slug: string): Animal {
  const animal = animalBySlug(slug);
  if (animal === undefined) throw new Error(`no animal ${slug} in the data`);
  return animal;
}

const BOAR = animalFor('javali');
const MOUFLON = animalFor('muflao');
const THRUSHES = animalFor('tordos');
const BOAR_SIZE = BOAR.questionIds.length;

const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const finish = (page: Page) => page.getByRole('button', { name: 'Finish', exact: true });
const scoreOf = (page: Page, name: string) => page.getByRole('region', { name: `${name} done`, exact: true });
const missedOnly = (page: Page) => page.getByRole('button', { name: /^Missed ones only \(\d+\)$/ });
const goAgain = (page: Page) => page.getByRole('button', { name: 'Go again', exact: true });
const backToAnimals = (page: Page) => page.getByRole('link', { name: 'Back to animals', exact: true });
/** The line over the question card, "Practising" and the tile's Portuguese name in a chip. */
const practising = (page: Page) => page.getByRole('main').locator('p', { has: page.locator('[data-slot="badge"]') });

/** Opens the Animals grid from Home's card, in English. */
async function openGridFromHome(page: Page) {
  await page.getByRole('main').getByRole('link', { name: CARD, exact: true }).click();
  await expect(page).toHaveURL(/\/cacador\/animals$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Animals');
}

/** Opens the animal's pass from its tile on the grid. */
async function openPass(page: Page, animal: Animal) {
  await animalTileOf(page, animal.slug).tile.click();
  await expect(page).toHaveURL(new RegExp(`/cacador/animals/${animal.slug}$`));
}

/** Answers the pass's question on screen right or wrong by the bank's key, checking it is `id`. */
async function answer(page: Page, id: number, right: boolean) {
  expect(await shownId(page)).toBe(id);
  const question = questionFor(id);
  await answerPractice(page, right ? question.answer : wrongOf(question));
}

async function clearProgress(page: Page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clear progress' }).click();
  await page.getByRole('alertdialog', { name: 'Clear all progress?' }).getByRole('button', { name: 'Clear everything' }).click();
  await expect(page.getByRole('status')).toHaveText('Progress cleared');
}

test('animal practice: the card, the grid, a pass kept and finished, Missed ones only, credits, Português and Clear progress', async ({ page }) => {
  test.setTimeout(180_000);
  const stored = () => page.evaluate((name) => localStorage.getItem(name), ANIMALS_KEY);

  await test.step('Home: five start cards; "Animals One animal at a time · every question about it" is under Words, the width of the column with the ink hairline, and opens /cacador/animals (D6, D14)', async () => {
    await page.goto('./');
    await expectStartCards(page);
    const card = startCards(page).nth(2);
    await expect(card).toHaveAccessibleName(CARD);
    await expect(card).not.toHaveCSS('background-color', LIGHT.rust);
    await expect(card).toHaveCSS('border-top-color', LIGHT.ink);
    await openGridFromHome(page);
  });

  await test.step('the grid: the heading "Animals", 19 tiles three to a row in the data\'s order, every photo loaded; "Javali" over "Wild boar", "Tordos" over "Thrushes"; no chip; the tab bar with no tab current; "Back to Home" (D4, D7, D16, D21)', async () => {
    await expect(screenHeader(page).getByRole('link', { name: 'Back to Home', exact: true })).toBeVisible();
    await expectTabBar(page, TABS);
    const tiles = animalTiles(page);
    await expect(tiles).toHaveCount(19);
    for (const [i, animal] of animals.entries()) {
      await expect(tiles.nth(i)).toHaveAttribute('href', `/cacador/animals/${animal.slug}`);
      await expect(tiles.nth(i)).toHaveAccessibleName(`${animal.pt}, ${animal.en}`);
    }
    await expectPhotosLoaded(page, 19);

    // Three to a row: each row's tiles share a top, side by side; the next row starts under them.
    const boxes = await Promise.all(animals.map((_, i) => boxOf(tiles.nth(i))));
    for (const [i, box] of boxes.entries()) {
      const column = i % 3;
      const first = boxes[i - column];
      if (first === undefined) throw new Error('no row');
      if (column > 0) {
        expect(Math.abs(box.y - first.y), `tile ${i + 1} is in tile ${i - column + 1}'s row`).toBeLessThanOrEqual(1);
        expect(box.x, `tile ${i + 1} is right of the one before`).toBeGreaterThan((boxes[i - 1]?.x ?? 0) + 1);
      } else if (i > 0) {
        expect(box.y, `tile ${i + 1} starts a new row`).toBeGreaterThan((boxes[i - 1]?.y ?? 0) + 1);
        expect(Math.abs(box.x - (boxes[0]?.x ?? 0)), `tile ${i + 1} is in the first column`).toBeLessThanOrEqual(1);
      }
    }

    for (const animal of [BOAR, THRUSHES]) {
      const { pt, en } = animalTileOf(page, animal.slug);
      await expect(pt).toHaveText(animal.pt);
      await expect(en).toHaveText(animal.en);
      expect((await boxOf(en)).y, `${animal.en} is under ${animal.pt}`).toBeGreaterThan((await boxOf(pt)).y);
    }
    await expect(animalTileOf(page, THRUSHES.slug).pt).toHaveText('Tordos');
    await expect(animalTileOf(page, THRUSHES.slug).en).toHaveText('Thrushes');
    await expect(tiles.locator('span.absolute'), 'no chip on any tile').toHaveCount(0);
  });

  await test.step(`the boar: /cacador/animals/javali, "1 of ${BOAR_SIZE}", the chip "Practising Javali", question ${BOAR.questionIds[0]}; three answered (one wrong); Home and back to Animals: the boar's tile reads "3 of ${BOAR_SIZE}"; opened again: "4 of ${BOAR_SIZE}" (D9, D12)`, async () => {
    await openPass(page, BOAR);
    await expect(roundCounter(page)).toHaveText(`1 of ${BOAR_SIZE}`);
    await expectFraunces(page, roundCounter(page));
    await expect(practising(page)).toContainText('Practising');
    await expect(practising(page).locator('[data-slot="badge"]')).toHaveText('Javali');
    await expect(screenHeader(page).getByRole('link', { name: 'Back to Home', exact: true })).toBeVisible();
    await expectTabBar(page, TABS);
    await expect(cardOf(page).peek).toBeVisible();
    await expect(cardOf(page).hint).toBeVisible();

    const [first, second, third, fourth] = BOAR.questionIds;
    expect(first).toBe(123);
    await answer(page, first!, false);
    await expect(page.getByRole('group', { name: 'Report a problem with this question', exact: true })).toBeVisible();
    await nextPractice(page, first!);
    await expect(roundCounter(page)).toHaveText(`2 of ${BOAR_SIZE}`);
    await answer(page, second!, true);
    await nextPractice(page, second!);
    await expect(roundCounter(page)).toHaveText(`3 of ${BOAR_SIZE}`);
    await answer(page, third!, true);

    await tab(page, 'Home').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Caçador' })).toBeVisible();
    await openGridFromHome(page);
    const boar = animalTileOf(page, BOAR.slug);
    await expect(boar.chip).toHaveText(`3 of ${BOAR_SIZE}`);
    await expect(boar.chip).toHaveCSS('background-color', LIGHT.clay);
    await expect(boar.chip).toHaveCSS('border-top-color', LIGHT.rust);
    await expect(boar.chip).toHaveCSS('color', LIGHT.ink);
    await expect(boar.tile).toHaveAccessibleName(`Javali, Wild boar, 3 of ${BOAR_SIZE} answered`);
    await expect(animalTiles(page).locator('span.absolute'), 'the boar\'s chip alone').toHaveCount(1);

    await openPass(page, BOAR);
    await expect(roundCounter(page)).toHaveText(`4 of ${BOAR_SIZE}`);
    expect(await shownId(page)).toBe(fourth);
  });

  await test.step(`a reload: still "4 of ${BOAR_SIZE}"; the rest answered by the key, Finish on the last: "Javali done", "${BOAR_SIZE - 1} of ${BOAR_SIZE} right", a rust "Missed ones only (1)", Go again, Back to animals (D3, D10, D18)`, async () => {
    await page.reload();
    await expect(roundCounter(page)).toHaveText(`4 of ${BOAR_SIZE}`);
    for (let n = 4; n <= BOAR_SIZE; n++) {
      const id = BOAR.questionIds[n - 1]!;
      await expect(roundCounter(page)).toHaveText(`${n} of ${BOAR_SIZE}`);
      await answer(page, id, true);
      if (n < BOAR_SIZE) {
        await expect(finish(page)).toHaveCount(0);
        await nextPractice(page, id);
      } else {
        await expect(next(page)).toHaveCount(0);
        await finish(page).click();
      }
    }

    const score = scoreOf(page, 'Javali');
    await expect(score).toBeVisible();
    await expectFraunces(page, score.getByText(String(BOAR_SIZE - 1), { exact: true }));
    await expect(score).toContainText(`${BOAR_SIZE - 1} of ${BOAR_SIZE} right`);
    await expect(roundCounter(page)).toHaveText(`${BOAR_SIZE} of ${BOAR_SIZE}`);
    await expect(missedOnly(page)).toHaveText('Missed ones only (1)');
    await expect(missedOnly(page)).toHaveCSS('background-color', LIGHT.rust);
    await expect(goAgain(page)).toBeVisible();
    await expect(goAgain(page)).not.toHaveCSS('background-color', LIGHT.rust);
    await expect(backToAnimals(page)).toHaveAttribute('href', '/cacador/animals');
    await expect(backToAnimals(page)).not.toHaveCSS('background-color', LIGHT.rust);
  });

  await test.step(`Missed ones only: "1 of 1", question ${BOAR.questionIds[0]}; answered right: "1 of 1 right" and no Missed ones only; Back to animals: the boar's tile reads "${BOAR_SIZE - 1}/${BOAR_SIZE}" in forest (D13, D17, D20)`, async () => {
    await missedOnly(page).click();
    await expect(roundCounter(page)).toHaveText('1 of 1');
    await answer(page, BOAR.questionIds[0]!, true);
    await expect(next(page)).toHaveCount(0);
    await finish(page).click();
    const score = scoreOf(page, 'Javali');
    await expect(score).toContainText('1 of 1 right');
    await expect(missedOnly(page)).toHaveCount(0);
    await expect(goAgain(page)).toHaveCSS('background-color', LIGHT.rust);

    await backToAnimals(page).click();
    await expect(page).toHaveURL(/\/cacador\/animals$/);
    const boar = animalTileOf(page, BOAR.slug);
    await expect(boar.chip).toHaveText(`${BOAR_SIZE - 1}/${BOAR_SIZE}`);
    await expect(boar.chip).toHaveCSS('color', LIGHT.forest);
    await expectFraunces(page, boar.chip);
    await expect(boar.tile).toHaveAccessibleName(`Javali, Wild boar, ${BOAR_SIZE - 1} of ${BOAR_SIZE} right`);
  });

  await test.step(`the mouflon, all ${MOUFLON.questionIds.length} wrong: its tile reads "0/${MOUFLON.questionIds.length}" in rust (D17)`, async () => {
    const size = MOUFLON.questionIds.length;
    await openPass(page, MOUFLON);
    for (const [i, id] of MOUFLON.questionIds.entries()) {
      await expect(roundCounter(page)).toHaveText(`${i + 1} of ${size}`);
      await answer(page, id, false);
      if (i < size - 1) await nextPractice(page, id);
    }
    await finish(page).click();
    await expect(scoreOf(page, MOUFLON.pt)).toContainText(`0 of ${size} right`);
    await expect(missedOnly(page)).toHaveText(`Missed ones only (${size})`);
    await backToAnimals(page).click();
    const mouflon = animalTileOf(page, MOUFLON.slug);
    await expect(mouflon.chip).toHaveText(`0/${size}`);
    await expect(mouflon.chip).toHaveCSS('color', LIGHT.rust);
  });

  await test.step('Photo credits: the intro line, 19 rows in the grid\'s order, the boar\'s author and licence, and its Source link to its Commons page (D8, D19)', async () => {
    await page.getByRole('link', { name: 'Photo credits', exact: true }).click();
    await expect(page).toHaveURL(/\/cacador\/animals\/credits$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo credits');
    await expect(page.getByText('Photos from Wikimedia Commons, resized and cropped.', { exact: true })).toBeVisible();
    await expectTabBar(page, TABS);
    const rows = page.getByRole('main').getByRole('listitem');
    await expect(rows).toHaveCount(19);
    for (const [i, animal] of animals.entries()) await expect(rows.nth(i).locator('[lang="pt-PT"]')).toHaveText(animal.pt);
    const boar = rows.filter({ has: page.locator('[lang="pt-PT"]', { hasText: /^Javali$/ }) });
    await expect(boar).toContainText(BOAR.author);
    await expect(boar).toContainText(BOAR.licence);
    const source = boar.getByRole('link', { name: 'Source: Javali', exact: true });
    await expect(source).toHaveText('Source');
    await expect(source).toHaveAttribute('href', BOAR.source);
    await expect(source).toHaveAttribute('target', '_blank');
  });

  await test.step('Português in Settings: the card "Animais …", the grid\'s title "Animais", the boar\'s tile still "Javali" over "Wild boar", the mouflon\'s pass counting "1 de 3"; English brings them back (D14, D23)', async () => {
    await screenHeader(page).getByRole('link', { name: 'Back to Home', exact: true }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();

    const card = page.getByRole('main').getByRole('link', { name: CARD_PT, exact: true });
    await expect(card).toHaveAttribute('href', '/cacador/animals');
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Animais');
    const boar = animalTileOf(page, BOAR.slug);
    await expect(boar.pt).toHaveText('Javali');
    await expect(boar.en).toHaveText('Wild boar');
    await expect(boar.tile).toHaveAccessibleName(`Javali, Wild boar, ${BOAR_SIZE - 1} de ${BOAR_SIZE} certas`);
    await expect(page.getByRole('link', { name: 'Créditos das fotografias', exact: true })).toBeVisible();

    await openPass(page, MOUFLON);
    await expect(roundCounter(page)).toHaveText(`1 de ${MOUFLON.questionIds.length}`);
    await expect(practising(page)).toContainText('A praticar');

    await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();
    await page.getByRole('link', { name: 'Definições', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  });

  await test.step(`Clear progress, confirmed: localStorage holds no ${ANIMALS_KEY}, and the grid shows no chip (D13)`, async () => {
    expect(await stored(), 'the scores are kept before the clear').not.toBeNull();
    await clearProgress(page);
    expect(await stored()).toBeNull();

    await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
    await openGridFromHome(page);
    await expect(animalTiles(page)).toHaveCount(19);
    await expect(animalTiles(page).locator('span.absolute')).toHaveCount(0);
    await expect(animalTileOf(page, BOAR.slug).tile).toHaveAccessibleName('Javali, Wild boar');
  });
});
