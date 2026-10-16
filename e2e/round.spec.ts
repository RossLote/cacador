import { expect, test } from '@playwright/test';
import { seededRandom } from '../apps/web/src/model/random';
import { answerPractice, nextPractice, questionFor, screenHeader, shownId, tab, wrongOf } from './app';
import { expectFraunces, LIGHT } from './look';

const ROUND = 10;

// A round of ten (DESIGN.md § 6.4, bead cac-zdk): from Home's rust card, the header counts the questions, the last
// answer's button reads Finish, the score plate holds the count right and Another 10, and the Practice tab ends a round.
test('a round of ten from Home: the counter, Finish in place of the last Next, the score and Another 10', async ({ context, page }) => {
  await context.addInitScript({ content: `Math.random = (${seededRandom.toString()})(1);` });
  await page.goto('./');

  const main = page.getByRole('main');
  const roundCard = main.getByRole('link', { name: 'Quick 10 Weak ones first, then your score', exact: true });
  await expect(roundCard).toHaveCSS('background-color', LIGHT.rust);
  const practiceCard = main.getByRole('link', { name: 'Practice Weak ones first', exact: true });
  await expect(practiceCard).not.toHaveCSS('background-color', LIGHT.rust);
  // The round takes the whole row; Practice sits under it at half the width.
  const roundBox = await roundCard.boundingBox();
  const practiceBox = await practiceCard.boundingBox();
  expect(roundBox && practiceBox, 'the two cards are drawn').toBeTruthy();
  if (roundBox && practiceBox) {
    expect(roundBox.width).toBeGreaterThan(practiceBox.width * 1.9);
    expect(practiceBox.y).toBeGreaterThan(roundBox.y + roundBox.height - 1);
  }

  await roundCard.click();
  await expect(page).toHaveURL(/\/cacador\/practice\?round=10$/);
  const counter = screenHeader(page).getByText(/^\d+ of \d+$/);
  await expect(counter).toHaveText(`1 of ${ROUND}`);
  await expectFraunces(page, counter);

  const finish = page.getByRole('button', { name: 'Finish', exact: true });
  const next = page.getByRole('button', { name: 'Next', exact: true });
  let right = 0;
  for (let n = 1; n <= ROUND; n++) {
    await expect(counter).toHaveText(`${n} of ${ROUND}`);
    const question = questionFor(await shownId(page));
    // Every third answer right.
    const key = n % 3 === 0 ? question.answer : wrongOf(question);
    if (key === question.answer) right += 1;
    const id = await answerPractice(page, key);
    await expect(counter).toHaveText(`${n} of ${ROUND}`);
    if (n < ROUND) {
      await expect(finish).toHaveCount(0);
      await nextPractice(page, id);
    } else {
      await expect(next).toHaveCount(0);
      await finish.click();
    }
  }

  const plate = page.getByRole('region', { name: 'Round done' });
  await expect(plate).toBeVisible();
  const score = plate.getByText(String(right), { exact: true });
  await expectFraunces(page, score);
  await expect(plate).toContainText(`${right} of ${ROUND} right`);
  await expect(counter).toHaveText(`${ROUND} of ${ROUND}`);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hold for English', exact: true })).toHaveCount(0);
  await expect(screenHeader(page).getByRole('link', { name: 'Back to Home' })).toBeVisible();
  await expect(tab(page, 'Practice')).toBeVisible();

  const another = plate.getByRole('button', { name: `Another ${ROUND}`, exact: true });
  await expect(another).toHaveCSS('background-color', LIGHT.rust);
  await another.click();
  await expect(counter).toHaveText(`1 of ${ROUND}`);
  await shownId(page);
  await expect(plate).toHaveCount(0);

  // The Practice tab is endless practice: no counter, and Next after the answer.
  await tab(page, 'Practice').click();
  await expect(page).toHaveURL(/\/cacador\/practice$/);
  await shownId(page);
  await expect(screenHeader(page).getByText(/^\d+ of \d+$/)).toHaveCount(0);
  await answerPractice(page, wrongOf(questionFor(await shownId(page))));
  await expect(next).toBeVisible();
  await expect(finish).toHaveCount(0);
});
