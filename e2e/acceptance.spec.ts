import { readFileSync } from 'node:fs';
import { hintFor, questions, sectionOf, topicOf, topics, translationFor, type OptionKey } from '@cacador/data';
import { expect, test, type Locator, type Page } from '@playwright/test';
// Dependency-free leaves of the app's model: seededRandom is serialised into the page.
import { localDateKey } from '../apps/web/src/model/dates';
import { seededRandom } from '../apps/web/src/model/random';
import { answerPractice, cardOf, nextPractice, OPTION_KEYS, questionFor, screenHeader, shownId, tab, tabBar, wrongOf } from './app';
import { background, contrastRatio, DARK, expectFraunces, ground, LIGHT, TEXT_CONTRAST, textColour } from './look';

/**
 * ACCEPTANCE BAR steps 2 to 9 (epic cac-8cn, Campo), in order, in one fresh browser context at 390 px wide
 * (playwright.config.ts): the counts build on each other (5 answers, then 6, then the exam's 20). Step 10, offline
 * with the service worker, is offline.spec.ts; step 11, the built dist, is build-output.spec.ts. After step 9 the
 * phase 4 behaviours the Campo bar does not walk run on the same state: an exam answered from the key that passes,
 * an exam surviving a closed tab, Flagged and its copy, and export, clear and import.
 *
 * Practice and the exam draw with Math.random; every page load replaces it with the app's own seeded source, so every
 * run draws the same questions. SEED is one whose Ducks draw in step 6 is a question not answered before.
 */
const SEED = 1;

const TABS = ['Home', 'Practice', 'Exam', 'Progress'];
const TABS_PT = ['Início', 'Praticar', 'Exame', 'Progresso'];
const NOTE = 'nudge gives the answer away';
const EXAM_SIZE = 20;
const EXAM_SECONDS = 30 * 60;
/** How long the closed-tab check keeps the app closed, on the pages' clock. */
const CLOSED_MS = 3 * 60 * 1000;

/** mm:ss as seconds. */
function seconds(clock: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) throw new Error(`not a clock: ${clock}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The tab bar holds the four tabs by these names, `current` alone marked as the page (none when undefined). */
async function expectTabBar(page: Page, names: readonly string[], current?: string) {
  const links = tabBar(page).getByRole('link');
  await expect(links).toHaveText([...names]);
  for (const name of names) {
    const link = tab(page, name);
    if (name === current) await expect(link).toHaveAttribute('aria-current', 'page');
    else await expect(link).not.toHaveAttribute('aria-current');
  }
}

/** Where a locator is drawn; it must be. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`not drawn: ${locator.toString()}`);
  return box;
}

/** The bank id of the running exam's question, from the wrapper around its card. */
async function examShownId(page: Page): Promise<number> {
  const wrapper = page.locator('[data-question-id]');
  await expect(wrapper).toHaveCount(1);
  return Number(await wrapper.getAttribute('data-question-id'));
}

const homeHeading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: 'Caçador' });

async function goHome(page: Page) {
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(homeHeading(page)).toBeVisible();
}

/** Home's readiness plate once loaded: the percentage and the unseen count as shown. */
async function homeReadiness(page: Page): Promise<{ percent: string; unseen: string }> {
  const panel = page.getByRole('region', { name: 'Readiness' });
  const unseen = panel.getByText(/^\d+ unseen$/);
  await expect(unseen).toBeVisible();
  return { percent: (await panel.getByText(/^\d+ %$/).textContent()) ?? '', unseen: (await unseen.textContent()) ?? '' };
}

const examCard = (page: Page): Locator => page.getByRole('link', { name: /^Exam in progress/ });

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('acceptance bar steps 2 to 9, in order, in one browser context', async ({ context, page }) => {
  test.setTimeout(300_000);
  await context.addInitScript({ content: `Math.random = (${seededRandom.toString()})(${SEED});` });
  // The pages' clock runs with real time until a step moves it on.
  await context.clock.install();

  /** Every practice question answered so far, in order. */
  const answered: number[] = [];
  /** The first exam's questions, in exam order. */
  const examIds: number[] = [];

  await test.step('step 2: Home: the paper ground, "Caçador" in Fraunces, 33 % with "506 unseen", the rust tick at 75 % and "Pass line 75 %"; no exam card; main holds the three cards, Quick 10 over Practice and Exam; no "Weakest topics"; the tab bar holds the four tabs with Home current; the Settings control in the header', async () => {
    await page.goto('./');
    expect(await page.evaluate(() => Math.random.toString()), 'Math.random is the seeded source').not.toContain('[native code]');
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT.paper);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caçador');
    await expectFraunces(page, homeHeading(page));

    expect(await homeReadiness(page)).toEqual({ percent: '33 %', unseen: '506 unseen' });
    const plate = page.getByRole('region', { name: 'Readiness' });
    const passLine = plate.getByText('Pass line 75 %', { exact: true });
    await expect(passLine).toBeVisible();
    await expect(passLine).toHaveCSS('color', LIGHT.rust);
    const tick = plate.locator('[data-slot="pass-tick"]');
    await expect(tick).toHaveCSS('background-color', LIGHT.rust);
    const tickBox = await tick.boundingBox();
    const barBox = await plate.getByRole('progressbar', { name: 'Readiness' }).boundingBox();
    expect(tickBox && barBox, 'the tick and the bar are drawn').toBeTruthy();
    if (tickBox && barBox) {
      expect(Math.abs(tickBox.x + tickBox.width / 2 - (barBox.x + 0.75 * barBox.width)), 'the tick sits at 75 %').toBeLessThanOrEqual(1.5);
    }

    await expect(examCard(page)).toHaveCount(0);
    const main = page.getByRole('main');
    // The three cards and the Settings control are main's only links; the tabs sit outside it.
    await expect(main.getByRole('link')).toHaveCount(4);
    await expect(main.getByRole('link', { name: 'Quick 10 Weak ones first, then your score', exact: true })).toHaveAttribute('href', '/cacador/practice?round=10');
    await expect(main.getByRole('link', { name: 'Practice Weak ones first', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Exam 20 questions · 30 min', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weakest topics' })).toHaveCount(0);
    await expectTabBar(page, TABS, 'Home');
    // The header is the row the app name opens.
    await expect(homeHeading(page).locator('xpath=..').getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });

  await test.step('step 3: the Practice tab: the header shows the back control, the section · topic eyebrow and "Question N"; Hold for English and Hint sit in the dock directly over the tab bar, outside the card; holding "Hold for English" turns the stem English and the button ink and the button does not move; releasing brings the Portuguese back; Hint opens the moss panel with "Language notes" and no "Nudge" after the options, in view over the dock', async () => {
    await tab(page, 'Practice').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice');
    const header = screenHeader(page);
    await expect(header.getByRole('link', { name: 'Back to Home' })).toBeVisible();
    const id = await shownId(page);
    const question = questionFor(id);
    const english = translationFor(id);
    await expect(header.getByText(`${sectionOf(question)?.en} · ${topicOf(question)?.en}`, { exact: true })).toBeVisible();

    const { card, stem, options, peek, hint, hintPanel } = cardOf(page);
    await expect(card.getByRole('img', { name: `The picture for question ${id}` })).toHaveCount(question.image ? 1 : 0);
    await expect(options).toHaveCount(3);
    await expect(stem).toHaveText(question.question);
    await expect(stem).toHaveAttribute('lang', 'pt-PT');

    // Docked (cac-2tb): outside the card, on the paper strip sitting on the tab bar at the foot of the viewport.
    await expect(card.getByRole('button', { name: 'Hold for English', exact: true })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
    const strip = peek.locator('xpath=../..');
    await expect(strip).toHaveCSS('background-color', LIGHT.paper);
    const stripBox = await boxOf(strip);
    const barBox = await boxOf(tabBar(page));
    expect(Math.abs(stripBox.y + stripBox.height - barBox.y), 'the strip sits on the tab bar').toBeLessThanOrEqual(0.5);
    const foot = page.viewportSize()?.height ?? 0;
    expect(Math.abs(barBox.y + barBox.height - foot), 'the tab bar sits at the foot of the viewport').toBeLessThanOrEqual(0.5);
    const held = await boxOf(peek);
    expect((await boxOf(hint)).y).toBe(held.y);

    await peek.hover();
    await page.mouse.down();
    await expect(stem).toHaveAttribute('lang', 'en');
    await expect(stem).toHaveText(english?.question ?? '');
    await expect(options.first()).toContainText(english?.options.A ?? '');
    await expect(peek).toHaveCSS('background-color', LIGHT.ink);
    // The English reflows the card; the button stays under the thumb (a pressed button sinks 1 px).
    expect(Math.abs((await boxOf(peek)).y - held.y), 'the button stays under the thumb').toBeLessThanOrEqual(1);
    expect((await boxOf(strip)).y, 'the dock stays put').toBe(stripBox.y);
    await page.mouse.up();
    await expect(stem).toHaveAttribute('lang', 'pt-PT');
    await expect(stem).toHaveText(question.question);
    await expect(options.first()).toContainText(question.options.A);
    await expect(peek).not.toHaveCSS('background-color', LIGHT.ink);

    await hint.click();
    await expect(hintPanel).toHaveCSS('background-color', LIGHT.moss);
    await expect(options.last().locator('xpath=../following-sibling::*[1]')).toHaveAttribute('aria-label', 'Hint');
    const panelBox = await boxOf(hintPanel);
    expect(panelBox.y + panelBox.height, 'the panel is brought into view over the dock').toBeLessThanOrEqual(stripBox.y + 0.5);
    await expect(hintPanel.getByRole('heading', { name: 'Language notes' })).toBeVisible();
    const notes = hintFor(id)?.language ?? [];
    if (notes.length === 0) await expect(hintPanel.getByText('No language notes for this question.')).toBeVisible();
    else await expect(hintPanel.getByRole('listitem')).toHaveCount(notes.length);
    await expect(hintPanel.getByRole('heading', { name: 'Nudge' })).toHaveCount(0);
  });

  await test.step('step 4: a wrong option (from the bank\'s key): that row clay with "Wrong", the correct row moss with "Right"; the panel gains "Nudge"; the flags row shows "Report:" and the two chips; "Hint is off" sets the chip and opens the note field; Next draws a different question with the panel closed', async () => {
    const id = await shownId(page);
    const question = questionFor(id);
    const wrong = wrongOf(question);
    answered.push(await answerPractice(page, wrong));

    const { option, hintPanel } = cardOf(page);
    await expect(option(wrong)).toHaveCSS('background-color', LIGHT.clay);
    await expect(option(wrong)).toContainText('Wrong');
    await expect(option(question.answer)).toHaveCSS('background-color', LIGHT.moss);
    await expect(option(question.answer)).toContainText('Right');

    await expect(hintPanel.getByRole('heading', { name: 'Nudge' })).toBeVisible();
    await expect(hintPanel).toContainText(hintFor(id)?.nudge ?? '');

    const flags = page.getByRole('group', { name: 'Report a problem with this question' });
    await expect(flags.getByText('Report:', { exact: true })).toBeVisible();
    await expect(flags.getByRole('button')).toHaveText(['English is off', 'Hint is off']);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

    await flags.getByRole('button', { name: 'Hint is off' }).click();
    await expect(flags.getByRole('button', { name: 'Hint is off' })).toHaveAttribute('aria-pressed', 'true');
    const note = flags.getByRole('textbox', { name: 'What is off with the hint' });
    await expect(note).toBeVisible();
    await note.fill(NOTE);
    await flags.getByRole('button', { name: 'Save' }).click();
    await expect(flags.getByRole('status')).toHaveText('Saved');

    await nextPractice(page, id);
    await expect(cardOf(page).hintPanel).toHaveCount(0);
  });

  await test.step('step 5: four more answers, then the Progress tab: the header reads "Progress" with "N % · 501 unseen"; the 30-day plate shows one bar, today\'s, in rust, and "Today: 5 answers, M right"; Topics is underlined; the started rows first with a percentage and "Seen x of y", the "Not started" rows last, 29 rows in all; Progress current in the tab bar; the "Flagged (1)" row at the bottom', async () => {
    for (let n = 0; n < 4; n++) {
      const id = await shownId(page);
      answered.push(await answerPractice(page, questionFor(id).answer));
      if (n < 3) await nextPractice(page, id);
    }
    expect(new Set(answered).size).toBe(5);

    await tab(page, 'Progress').click();
    const header = screenHeader(page);
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('Progress');
    await expect(header.getByRole('region', { name: 'Readiness' })).toContainText(/^\d+ %\s*·\s*501 unseen/);

    const bars = page.getByRole('list', { name: 'Answers per day, oldest first' }).getByRole('img');
    await expect(bars).toHaveCount(30);
    await expect(bars.filter({ visible: true })).toHaveCount(1);
    await expect(bars.last()).toHaveAccessibleName(/^Today, .+: 5 answers, 4 right$/);
    await expect(bars.last().locator('[data-slot="day-right"]')).toHaveCSS('background-color', LIGHT.rust);
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 5 answers, 4 right');

    const underline = (name: string) =>
      page.getByRole('tab', { name }).evaluate((element) => {
        const after = getComputedStyle(element, '::after');
        return { opacity: after.opacity, height: after.height, colour: after.backgroundColor };
      });
    await expect(page.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => underline('Topics')).toEqual({ opacity: '1', height: '2px', colour: LIGHT.forest });
    for (const name of ['Sections', 'Patterns']) await expect.poll(() => underline(name).then((u) => u.opacity)).toBe('0');

    const started = new Set(answered.map((id) => topicOf(questionFor(id))?.slug)).size;
    const rows = page.getByRole('tabpanel').getByRole('link');
    expect(topics).toHaveLength(29);
    await expect(rows).toHaveCount(29);
    for (let i = 0; i < 29; i++) {
      const row = rows.nth(i);
      if (i < started) {
        await expect(row).toHaveAccessibleName(/: \d+ %, seen \d+ of \d+$/);
        await expect(row.getByText(/^Seen \d+ of \d+$/)).toBeVisible();
        await expect(row.getByText(/^\d+ %$/)).toBeVisible();
      } else {
        await expect(row).toHaveAccessibleName(/: not started, \d+ questions?$/);
        await expect(row.getByText(/^Not started · \d+ questions?$/)).toBeVisible();
      }
    }

    await expectTabBar(page, TABS, 'Progress');
    await expect(page.getByRole('main').getByRole('link').last()).toHaveText('Flagged (1)');
  });

  await test.step('step 6: the Ducks row opens Practice with the chip "Practising Ducks"; one answer; the Home tab: "Weakest topics" with at least one row and the "All topics" link; the answered topic\'s row names it with its percentage', async () => {
    const ducks = topics.find((topic) => topic.slug === 'patos');
    const [from, to] = ducks?.ranges[0] ?? [0, 0];
    const inDucks = (id: number) => id >= from && id <= to;
    await page.getByRole('tabpanel').getByRole('link', { name: /^Ducks:/ }).click();
    await expect(page).toHaveURL(/\/cacador\/practice\?topic=patos$/);
    const focus = page.getByText('Practising');
    await expect(focus).toBeVisible();
    await expect(focus.getByText('Ducks', { exact: true })).toBeVisible();

    const id = await shownId(page);
    await expect(screenHeader(page)).toContainText('· Ducks');
    expect(inDucks(id)).toBe(true);
    // A question not answered before, so the Ducks row reads "seen 1"; a change to the seed or the draw that breaks this fails here.
    expect(answered).not.toContain(id);
    // Wrong, so Ducks is at 0 % and certainly one of Home's two weakest topics.
    answered.push(await answerPractice(page, wrongOf(questionFor(id))));
    const seenInDucks = new Set(answered.filter(inDucks)).size;

    const next = await nextPractice(page, id);
    expect(inDucks(next)).toBe(true);
    await expect(screenHeader(page)).toContainText('· Ducks');

    await tab(page, 'Home').click();
    // Home's readiness plate follows the stored answers: six questions seen, so 500 of the bank's 506 unseen.
    expect((await homeReadiness(page)).unseen).toBe(`${questions.length - new Set(answered).size} unseen`);
    const weakest = page.getByRole('region', { name: 'Weakest topics' });
    await expect(weakest.getByRole('heading', { name: 'Weakest topics' })).toBeVisible();
    await expect(weakest.getByRole('link', { name: 'All topics', exact: true })).toBeVisible();
    const weakestRows = weakest.getByRole('listitem');
    expect(await weakestRows.count()).toBeGreaterThanOrEqual(1);
    const ducksRow = weakest.getByRole('link', { name: new RegExp(`^Ducks: \\d+ %, seen ${seenInDucks} of \\d+$`) });
    await expect(ducksRow).toBeVisible();
    await expect(ducksRow.getByText('Ducks', { exact: true })).toBeVisible();
    await expect(ducksRow.getByText(/^\d+ %$/)).toBeVisible();
    test.info().annotations.push({ type: 'practice answers', description: answered.join(', ') });
  });

  await test.step('step 7: the Exam tab: Start; no tab bar, the back control, "1 of 20", the "Time left" chip counting from 30:00, 20 markers with marker 1 rust; an option fills ink; Next makes marker 1 forest and marker 2 rust; Submit reads "Submit · 19 unanswered"; confirming shows the score in Fraunces, "Pass mark 15", the "Not passed" chip in clay, the wrong answers, and the tab bar back with no tab current', async () => {
    await tab(page, 'Exam').click();
    await page.getByRole('button', { name: 'Start' }).click();
    const header = screenHeader(page);
    await expect(header.getByText('1 of 20', { exact: true })).toBeVisible();
    await expect(tabBar(page)).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Back to Home' })).toBeVisible();

    const clock = header.getByRole('timer', { name: 'Time left' });
    await expect(clock).toHaveText(/^(30:00|29:\d\d)$/);
    const clockSeconds = async () => seconds((await clock.textContent()) ?? '');
    const shown = await clockSeconds();
    await context.clock.fastForward(2_000);
    await expect.poll(clockSeconds).toBeLessThan(shown);

    const markers = page.getByRole('navigation', { name: 'Questions' }).getByRole('button');
    await expect(markers).toHaveCount(EXAM_SIZE);
    const marker = (n: number) => page.getByRole('button', { name: `Question ${n}`, exact: true });
    await expect(marker(1)).toHaveAttribute('aria-current', 'step');
    await expect(marker(1)).toHaveCSS('background-color', LIGHT.rust);
    const { option, peek, hint } = cardOf(page);
    await expect(peek).toHaveCount(0);
    await expect(hint).toHaveCount(0);

    const first = questionFor(await examShownId(page));
    examIds[0] = first.id;
    await option(first.answer).click();
    await expect(option(first.answer)).toHaveAttribute('aria-pressed', 'true');
    await expect(option(first.answer)).toHaveCSS('background-color', LIGHT.ink);
    await expect(marker(1)).toHaveAttribute('data-answered', 'true');

    const next = page.getByRole('button', { name: 'Next', exact: true });
    const previous = page.getByRole('button', { name: 'Previous', exact: true });
    await next.click();
    await expect(header.getByText('2 of 20', { exact: true })).toBeVisible();
    await expect(marker(1)).toHaveCSS('background-color', LIGHT.forest);
    await expect(marker(2)).toHaveAttribute('aria-current', 'step');
    await expect(marker(2)).toHaveCSS('background-color', LIGHT.rust);
    const submit = page.getByRole('button', { name: 'Submit · 19 unanswered', exact: true });
    await expect(submit).toBeVisible();

    // Moving freely: jump to 20, back one with Previous, then to 1 by its marker, whose answer is kept and changed to a wrong one.
    examIds[1] = await examShownId(page);
    await marker(20).click();
    await expect(header.getByText('20 of 20', { exact: true })).toBeVisible();
    examIds[19] = await examShownId(page);
    await previous.click();
    await expect(header.getByText('19 of 20', { exact: true })).toBeVisible();
    await marker(1).click();
    await expect(header.getByText('1 of 20', { exact: true })).toBeVisible();
    expect(await examShownId(page)).toBe(first.id);
    await expect(option(first.answer)).toHaveAttribute('aria-pressed', 'true');
    await option(wrongOf(first)).click();
    await expect(option(wrongOf(first))).toHaveAttribute('aria-pressed', 'true');
    await expect(option(first.answer)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-answered="true"]')).toHaveCount(1);
    expect(new Set(examIds.filter(Boolean)).size).toBe(3);

    await submit.click();
    const confirm = page.getByRole('alertdialog', { name: '19 unanswered — submit anyway?' });
    await confirm.getByRole('button', { name: 'Submit', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exam results');
    const score = page.getByRole('region', { name: 'Score' });
    const points = score.getByText(/^\d+ out of 20$/);
    await expect(points).toHaveText('0 out of 20');
    await expectFraunces(page, points);
    await expect(score.getByText('Pass mark 15', { exact: true })).toBeVisible();
    const notPassed = score.getByText('Not passed', { exact: true });
    await expect(notPassed).toHaveCSS('background-color', LIGHT.clay);
    await expect(notPassed).toHaveCSS('color', LIGHT.ink);

    // Every question is wrong: the first answered wrong, the other 19 unanswered.
    const wrong = page.getByRole('list', { name: 'Wrong answers' }).locator(':scope > li');
    await expect(wrong).toHaveCount(EXAM_SIZE);
    const answeredItem = wrong.first();
    await expect(answeredItem.getByText(`Question ${first.id}`, { exact: true })).toBeVisible();
    const marks = cardOf(answeredItem).options;
    await expect(marks.nth(OPTION_KEYS.indexOf(first.answer))).toHaveAttribute('data-mark', 'correct');
    await expect(marks.nth(OPTION_KEYS.indexOf(wrongOf(first)))).toHaveAttribute('data-mark', 'wrong');
    await expect(answeredItem.getByText('Not answered', { exact: true })).toHaveCount(0);
    for (const [n, item] of [[2, wrong.nth(1)], [20, wrong.last()]] as const) {
      const question = questionFor(examIds[n - 1] ?? 0);
      await expect(item.getByText(`Question ${question.id}`, { exact: true })).toBeVisible();
      await expect(item.getByText('Not answered', { exact: true })).toBeVisible();
      await expect(item.locator('[data-mark]')).toHaveCount(1);
      await expect(cardOf(item).option(question.answer)).toHaveAttribute('data-mark', 'correct');
    }
    // A review card keeps its own Hold for English and Hint, at its top over the stem, so a peek moves neither (cac-2tb).
    const review = cardOf(answeredItem);
    await expect(review.card.getByRole('button', { name: 'Hold for English', exact: true })).toBeVisible();
    await review.peek.scrollIntoViewIfNeeded();
    const reviewHeld = await boxOf(review.peek);
    expect((await boxOf(review.stem)).y, 'the stem is under the row').toBeGreaterThan(reviewHeld.y);
    await review.peek.hover();
    await page.mouse.down();
    await expect(review.stem).toHaveAttribute('lang', 'en');
    expect(Math.abs((await boxOf(review.peek)).y - reviewHeld.y), 'the button stays under the thumb').toBeLessThanOrEqual(1);
    await page.mouse.up();
    await expect(review.stem).toHaveAttribute('lang', 'pt-PT');
    await expect(review.hint).toBeVisible();
    await review.hint.click();
    await expect(review.hintPanel).toBeVisible();

    await expectTabBar(page, TABS);
  });

  await test.step('step 8: dark: with prefers-color-scheme dark emulated, Home\'s body is #151A17, the heading #EDE8DB, and the heading against the body, and the muted unseen count and the rust pass line against the plate they sit on, each pass 4.5:1', async () => {
    await tab(page, 'Home').click();
    await expect(homeHeading(page)).toBeVisible();
    await page.emulateMedia({ colorScheme: 'dark' });
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', DARK.paper);
    await expect(homeHeading(page)).toHaveCSS('color', DARK.ink);
    const plate = page.getByRole('region', { name: 'Readiness' });
    const unseen = plate.getByText(/^\d+ unseen$/);
    const passLine = plate.getByText('Pass line 75 %', { exact: true });
    await expect(unseen).toHaveCSS('color', DARK.muted);
    await expect(passLine).toHaveCSS('color', DARK.rust);

    // Each text against the colour it sits on (DESIGN.md § 8.5): the heading on the body, the other two on the plate.
    for (const [what, text, on, under, token] of [
      ['the heading', homeHeading(page), 'the body', await background(body), DARK.paper],
      ['the unseen count', unseen, 'the plate', await ground(unseen), DARK.card],
      ['the pass line', passLine, 'the plate', await ground(passLine), DARK.card],
    ] as const) {
      expect(under, `the ground under ${what}`).toBe(token);
      const ratio = contrastRatio(await textColour(text), under);
      test.info().annotations.push({ type: 'dark contrast', description: `${what} on ${on}: ${ratio.toFixed(2)}:1` });
      expect(ratio, `${what} against ${on}`).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(body).toHaveCSS('background-color', LIGHT.paper);
  });

  await test.step('step 9: Settings from Home\'s control: the eyebrows "Language" and "Progress"; Português turns the tab bar into Início, Praticar, Exame, Progresso and the back control into "Voltar ao início"; English brings them back', async () => {
    await homeHeading(page).locator('xpath=..').getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await expect(page.getByRole('heading', { level: 2, name: 'Language', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Progress', exact: true })).toBeVisible();
    await expectTabBar(page, TABS);

    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link')).toHaveText(TABS_PT);
    await expect(screenHeader(page).getByRole('link', { name: 'Voltar ao início', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Idioma' })).toBeVisible();
    for (const name of ['Exportar', 'Importar', 'Limpar o progresso']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }

    // The choice survives a reload, and Home and Practice follow it.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
    await page.getByRole('link', { name: 'Voltar ao início' }).click();
    await expect(page.getByText(/^\d+ por ver$/)).toBeVisible();
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Praticar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Praticar');
    const number = screenHeader(page).getByText(/^Pergunta \d+$/);
    await expect(number).toBeVisible();
    const question = questionFor(Number((await number.textContent())?.replace('Pergunta ', '')));
    await expect(screenHeader(page).getByText(`${sectionOf(question)?.pt} · ${topicOf(question)?.pt}`, { exact: true })).toBeVisible();
    const card = page.getByRole('article');
    await expect(card.getByRole('group', { name: 'Opções' }).getByRole('button')).toHaveCount(3);
    // Docked over the tab bar, outside the card (cac-2tb).
    await expect(page.getByRole('button', { name: 'Manter premido para ver em inglês' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dica', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Voltar ao início' }).click();
    await page.getByRole('link', { name: 'Definições', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expectTabBar(page, TABS);
    await expect(screenHeader(page).getByRole('link', { name: 'Back to Home', exact: true })).toBeVisible();
  });

  await test.step('after the bar: a second exam answered in full from the key, 16 right and 4 wrong, submits with the plain "Submit": "16 out of 20", the "Passed" chip in moss, only the 4 wrong ones listed; Progress lists it as Passed', async () => {
    await goHome(page);
    await tab(page, 'Exam').click();
    await page.getByRole('button', { name: 'Start' }).click();
    const header = screenHeader(page);
    const ids: number[] = [];
    const wrongIds: number[] = [];
    for (let n = 1; n <= EXAM_SIZE; n++) {
      await expect(header.getByText(`${n} of 20`, { exact: true })).toBeVisible();
      const question = questionFor(await examShownId(page));
      ids.push(question.id);
      // Every fifth one wrong: questions 5, 10, 15 and 20.
      const key = n % 5 === 0 ? wrongOf(question) : question.answer;
      if (key !== question.answer) wrongIds.push(question.id);
      await cardOf(page).option(key).click();
      await expect(page.getByRole('button', { name: `Question ${n}`, exact: true })).toHaveAttribute('data-answered', 'true');
      if (n < EXAM_SIZE) await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    expect(new Set(ids).size, 'the exam holds 20 different questions').toBe(EXAM_SIZE);

    // All 20 answered: Submit reads plain "Submit" and scores at once, with no confirm.
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exam results');
    const score = page.getByRole('region', { name: 'Score' });
    const points = score.getByText(/^\d+ out of 20$/);
    await expect(points).toHaveText('16 out of 20');
    await expect(score.getByText('Pass mark 15', { exact: true })).toBeVisible();
    const passed = score.getByText('Passed', { exact: true });
    await expect(passed).toHaveCSS('background-color', LIGHT.moss);
    await expect(passed).toHaveCSS('color', LIGHT.forest);
    await expect(score.getByText('Not passed', { exact: true })).toHaveCount(0);

    const wrong = page.getByRole('list', { name: 'Wrong answers' }).locator(':scope > li');
    await expect(wrong).toHaveCount(wrongIds.length);
    for (const [i, id] of wrongIds.entries()) {
      const item = wrong.nth(i);
      const question = questionFor(id);
      await expect(item.getByText(`Question ${id}`, { exact: true })).toBeVisible();
      await expect(cardOf(item).option(wrongOf(question))).toHaveAttribute('data-mark', 'wrong');
      await expect(cardOf(item).option(question.answer)).toHaveAttribute('data-mark', 'correct');
      await expect(item.getByText('Not answered', { exact: true })).toHaveCount(0);
    }

    await tab(page, 'Progress').click();
    const past = page.getByRole('region', { name: 'Past exams' }).getByRole('link');
    await expect(past).toHaveCount(2);
    await expect(past.first()).toHaveAccessibleName(/: 16 of 20, Passed$/);
    await expect(past.first().getByText('16 / 20', { exact: true })).toBeVisible();
    await expect(past.first().getByText('Passed', { exact: true })).toHaveCSS('background-color', LIGHT.moss);
    await expect(past.last()).toHaveAccessibleName(/: 0 of 20, Not passed$/);
  });

  await test.step('after the bar: a third exam with 3 answers survives closing the tab, its clock still running, and Home\'s card counts them', async () => {
    await goHome(page);
    await tab(page, 'Exam').click();
    const startClicked = Date.now();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('1 of 20', { exact: true })).toBeVisible();
    const startShown = Date.now();
    const chosen: OptionKey[] = ['A', 'B', 'C'];
    for (const [i, key] of chosen.entries()) {
      await expect(page.getByText(`${i + 1} of 20`, { exact: true })).toBeVisible();
      await cardOf(page).option(key).click();
      await expect(page.getByRole('button', { name: `Question ${i + 1}`, exact: true })).toHaveAttribute('data-answered', 'true');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Submit · 17 unanswered', exact: true })).toBeVisible();
    await page.close();

    // The app stays closed for three minutes, which the clock must have counted when it is opened again.
    page = await context.newPage();
    await context.clock.fastForward(CLOSED_MS);
    const reopened = Date.now() + CLOSED_MS;
    await page.goto('./');
    await expect(examCard(page)).toHaveText('Exam in progress 27 minutes left · 3 of 20 answered');
    await examCard(page).click();

    const markers = page.getByRole('navigation', { name: 'Questions' });
    await expect(markers.locator('[data-answered="true"]')).toHaveCount(3);
    for (const [i, key] of chosen.entries()) {
      await page.getByRole('button', { name: `Question ${i + 1}`, exact: true }).click();
      await expect(page.getByText(`${i + 1} of 20`, { exact: true })).toBeVisible();
      await expect(cardOf(page).option(key)).toHaveAttribute('aria-pressed', 'true');
    }

    // The clock counts from the exam's start (no later than it showed, no earlier than Start was clicked): it has moved
    // on by at least the time up to the reopening, and by no more than the time since the click; then it keeps running.
    const clock = page.getByRole('timer', { name: 'Time left' });
    const clockSeconds = async () => seconds((await clock.textContent()) ?? '');
    await expect.poll(clockSeconds).toBeLessThanOrEqual(EXAM_SECONDS - Math.floor((reopened - startShown) / 1000));
    const first = await clockSeconds();
    expect(first).toBeGreaterThanOrEqual(EXAM_SECONDS - Math.ceil((Date.now() + CLOSED_MS - startClicked) / 1000));
    await context.clock.fastForward(2_000);
    await expect.poll(clockSeconds).toBeLessThan(first);
  });

  await test.step('after the bar: Progress lists the two finished exams, the passed one first, and 46 answers; Flagged holds the one hint flag; Copy puts the header and its line; clearing it leaves none', async () => {
    await goHome(page);
    await tab(page, 'Progress').click();
    const past = page.getByRole('region', { name: 'Past exams' }).getByRole('link');
    await expect(past).toHaveCount(2);
    await expect(past.first()).toHaveAccessibleName(/: 16 of 20, Passed$/);
    await expect(past.last()).toHaveAccessibleName(/: 0 of 20, Not passed$/);
    // 6 practice answers, 4 right; the first exam's 20, none right; the passed exam's 20, 16 right.
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 46 answers, 20 right');

    await page.getByRole('link', { name: 'Flagged (1)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flagged');
    const id = answered[0] ?? 0;
    const rows = page.getByRole('list', { name: 'Flags, newest first' }).getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`Question ${id} · Hint`);
    await expect(rows.first()).toContainText(NOTE);
    await expect(rows.first()).toContainText(questionFor(id).question);

    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByRole('status')).toHaveText('Copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split('\n')).toEqual([`Caçador flags ${localDateKey(Date.now())}`, `#${id} Hint: ${NOTE}`]);

    await page.getByRole('button', { name: `Clear the Hint flag on question ${id}` }).click();
    await expect(page.getByText('No flags. Flag a question after answering it in Practice.')).toBeVisible();
    await expect(rows).toHaveCount(0);
  });

  await test.step('after the bar: Export, clear, import: the same readiness, exam card, 46 answers and 2 past exams come back', async () => {
    await goHome(page);
    const before = await homeReadiness(page);
    await expect(examCard(page)).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`cacador-progress-${localDateKey(Date.now())}.json`);
    const file = test.info().outputPath(download.suggestedFilename());
    await download.saveAs(file);
    const exported = JSON.parse(readFileSync(file, 'utf8')) as {
      answers: unknown[];
      exams: Array<{ finishedAt?: number; answers: Record<string, string> }>;
      flags: unknown[];
    };
    expect(exported.answers).toHaveLength(46);
    expect(exported.exams).toHaveLength(3);
    expect(exported.exams.filter((exam) => exam.finishedAt !== undefined)).toHaveLength(2);
    const unfinished = exported.exams.filter((exam) => exam.finishedAt === undefined);
    expect(unfinished).toHaveLength(1);
    expect(Object.keys(unfinished[0]?.answers ?? {})).toHaveLength(3);
    expect(exported.flags).toHaveLength(0);

    await page.getByRole('button', { name: 'Clear progress' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Clear all progress?' });
    await confirm.getByRole('button', { name: 'Clear everything' }).click();
    await expect(page.getByRole('status')).toHaveText('Progress cleared');
    await goHome(page);
    expect(await homeReadiness(page)).toEqual({ percent: '33 %', unseen: '506 unseen' });
    await expect(examCard(page)).toHaveCount(0);

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Progress file to import').setInputFiles(file);
    await expect(page.getByRole('status')).toHaveText('Added 46 answers, 3 exams and 0 flags');

    await goHome(page);
    expect(await homeReadiness(page)).toEqual(before);
    await expect(examCard(page)).toBeVisible();
    await tab(page, 'Progress').click();
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 46 answers, 20 right');
    const past = page.getByRole('region', { name: 'Past exams' }).getByRole('link');
    await expect(past).toHaveCount(2);
    await expect(past.first()).toHaveAccessibleName(/: 16 of 20, Passed$/);
  });
});
