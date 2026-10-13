import { readFileSync } from 'node:fs';
import { hintFor, questionById, sectionOf, topicOf, topics, translationFor, type OptionKey, type Question } from '@cacador/data';
import { expect, test, type Locator, type Page } from '@playwright/test';
// Dependency-free leaves of the app's model: seededRandom is serialised into the page.
import { localDateKey } from '../apps/web/src/model/dates';
import { seededRandom } from '../apps/web/src/model/random';

/**
 * ACCEPTANCE BAR steps 2 to 11 (epic cac-eil), in order, in one fresh browser context: the counts build on each other
 * (5 answers, then 6, then 26; the flag of step 4 is cleared in step 9; the export of step 10 holds what 2 to 9 made).
 * Step 12, offline with the service worker, is offline.spec.ts.
 *
 * Practice and the exam draw with Math.random; every page load replaces it with the app's own seeded source, so every
 * run draws the same questions. SEED is one whose Ducks draw in step 6 is a question not answered before.
 */
const SEED = 1;

const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C'];
const NOTE = 'nudge gives the answer away';
const EXAM_SIZE = 20;
const EXAM_SECONDS = 30 * 60;
/** How long step 8 keeps the app closed, on the pages' clock. */
const CLOSED_MS = 3 * 60 * 1000;

function questionFor(id: number): Question {
  const question = questionById(id);
  if (question === undefined) throw new Error(`no question ${id} in the bank`);
  return question;
}

const wrongOf = (question: Question): OptionKey => OPTION_KEYS.find((key) => key !== question.answer) ?? 'A';

/** mm:ss as seconds. */
function seconds(clock: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) throw new Error(`not a clock: ${clock}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The question card on screen and the parts of it the bar talks about. */
function cardOf(page: Page) {
  const card = page.getByRole('article');
  return {
    card,
    number: card.getByText(/^Question \d+$/),
    stem: card.locator(':scope > p[lang]'),
    options: card.getByRole('group', { name: 'Options' }).getByRole('button'),
    option: (key: OptionKey) => card.getByRole('group', { name: 'Options' }).getByRole('button').nth(OPTION_KEYS.indexOf(key)),
    peek: card.getByRole('button', { name: 'Hold for English', exact: true }),
    hint: card.getByRole('button', { name: 'Hint', exact: true }),
    hintPanel: card.getByRole('region', { name: 'Hint' }),
  };
}

/** The id in the card's "Question <id>" header, once a question is on screen. */
async function shownId(page: Page): Promise<number> {
  const number = cardOf(page).number;
  await expect(number).toBeVisible();
  return Number((await number.textContent())?.replace('Question ', ''));
}

async function goHome(page: Page) {
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Caçador' })).toBeVisible();
}

/** Home's readiness line once loaded: the percentage and the unseen count as shown. */
async function homeReadiness(page: Page): Promise<{ percent: string; unseen: string }> {
  const panel = page.getByRole('region', { name: 'Readiness' });
  const unseen = panel.getByText(/^\d+ unseen$/);
  await expect(unseen).toBeVisible();
  return { percent: (await panel.getByText(/^\d+ %$/).textContent()) ?? '', unseen: (await unseen.textContent()) ?? '' };
}

const examCard = (page: Page): Locator => page.getByRole('link', { name: /^Exam in progress/ });

/** Answers the practice question on screen with `key` and checks the result is revealed at once. */
async function answerPractice(page: Page, key: OptionKey): Promise<number> {
  const id = await shownId(page);
  const question = questionFor(id);
  const { option } = cardOf(page);
  await option(key).click();
  await expect(option(key)).toHaveAttribute('data-mark', key === question.answer ? 'right' : 'wrong');
  await expect(option(question.answer)).toHaveAttribute('data-mark', key === question.answer ? 'right' : 'correct');
  return id;
}

async function nextPractice(page: Page, previous: number): Promise<number> {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(cardOf(page).number).not.toHaveText(`Question ${previous}`);
  return shownId(page);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('acceptance bar steps 2 to 11, in order, in one browser context', async ({ context, page }) => {
  test.setTimeout(300_000);
  await context.addInitScript({ content: `Math.random = (${seededRandom.toString()})(${SEED});` });
  // The pages' clock runs with real time until step 8 moves it on.
  await context.clock.install();

  /** Every practice question answered so far, in order. */
  const answered: number[] = [];

  await test.step('step 2: Home shows 33 % against 75 %, 506 unseen, the four buttons and no exam card', async () => {
    await page.goto('./');
    expect(await page.evaluate(() => Math.random.toString()), 'Math.random is the seeded source').not.toContain('[native code]');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Caçador');
    expect(await homeReadiness(page)).toEqual({ percent: '33 %', unseen: '506 unseen' });
    await expect(page.getByText('Pass line 75 %')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link')).toHaveText(['Practice', 'Exam', 'Progress', 'Settings']);
    await expect(examCard(page)).toHaveCount(0);
  });

  await test.step('step 3: Practice shows a question; holding the peek shows English; Hint shows the language notes, no nudge', async () => {
    await page.getByRole('link', { name: 'Practice', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice');
    const id = await shownId(page);
    const question = questionFor(id);
    const english = translationFor(id);
    const { card, stem, options, peek, hint, hintPanel } = cardOf(page);

    await expect(card.locator('header')).toContainText(`${sectionOf(question)?.en} · ${topicOf(question)?.en}`);
    await expect(card.getByRole('img', { name: `The picture for question ${id}` })).toHaveCount(question.image ? 1 : 0);
    await expect(options).toHaveCount(3);
    await expect(stem).toHaveText(question.question);
    await expect(stem).toHaveAttribute('lang', 'pt-PT');

    await peek.hover();
    await page.mouse.down();
    await expect(stem).toHaveAttribute('lang', 'en');
    await expect(stem).toHaveText(english?.question ?? '');
    await expect(options.first()).toContainText(english?.options.A ?? '');
    await page.mouse.up();
    await expect(stem).toHaveAttribute('lang', 'pt-PT');
    await expect(stem).toHaveText(question.question);
    await expect(options.first()).toContainText(question.options.A);

    await hint.click();
    await expect(hintPanel.getByRole('heading', { name: 'Language notes' })).toBeVisible();
    const notes = hintFor(id)?.language ?? [];
    if (notes.length === 0) await expect(hintPanel.getByText('No language notes for this question.')).toBeVisible();
    else await expect(hintPanel.getByRole('listitem')).toHaveCount(notes.length);
    await expect(hintPanel.getByRole('heading', { name: 'Nudge' })).toHaveCount(0);
  });

  await test.step('step 4: an option marks the chosen and the correct one, shows the nudge and the flags row; flag the hint; Next', async () => {
    const id = await shownId(page);
    const question = questionFor(id);
    answered.push(await answerPractice(page, wrongOf(question)));

    const { hintPanel } = cardOf(page);
    await expect(hintPanel.getByRole('heading', { name: 'Nudge' })).toBeVisible();
    await expect(hintPanel).toContainText(hintFor(id)?.nudge ?? '');
    const flags = page.getByRole('group', { name: 'Report a problem with this question' });
    await expect(flags.getByRole('button', { name: 'English is off' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

    await flags.getByRole('button', { name: 'Hint is off' }).click();
    await expect(flags.getByRole('button', { name: 'Hint is off' })).toHaveAttribute('aria-pressed', 'true');
    await flags.getByLabel('What is off with the hint').fill(NOTE);
    await flags.getByRole('button', { name: 'Save' }).click();
    await expect(flags.getByRole('status')).toHaveText('Saved');

    await nextPractice(page, id);
  });

  await test.step('step 5: four more answers, five different ids; Progress and Home show 501 unseen', async () => {
    for (let n = 0; n < 4; n++) {
      const id = await shownId(page);
      answered.push(await answerPractice(page, questionFor(id).answer));
      if (n < 3) await nextPractice(page, id);
    }
    expect(new Set(answered).size).toBe(5);

    await goHome(page);
    expect((await homeReadiness(page)).unseen).toBe('501 unseen');
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Readiness' })).toContainText('501 unseen');
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 5 answers, 4 right');
  });

  await test.step('step 6: the Ducks row opens Practice on Ducks; one answer makes 6 today and 500 unseen', async () => {
    const ducks = topics.find((topic) => topic.slug === 'patos');
    const [from, to] = ducks?.ranges[0] ?? [0, 0];
    await page.getByRole('link', { name: /^Ducks:/ }).click();
    await expect(page).toHaveURL(/\/cacador\/practice\?topic=patos$/);
    await expect(page.getByText('Practising')).toContainText('Ducks');

    const id = await shownId(page);
    await expect(cardOf(page).card.locator('header')).toContainText('· Ducks');
    expect(id).toBeGreaterThanOrEqual(from);
    expect(id).toBeLessThanOrEqual(to);
    // 500 unseen needs a question not answered before; a change to the seed or the draw that breaks this fails here.
    expect(answered).not.toContain(id);
    answered.push(await answerPractice(page, questionFor(id).answer));

    const next = await nextPractice(page, id);
    expect(next).toBeGreaterThanOrEqual(from);
    expect(next).toBeLessThanOrEqual(to);
    await expect(cardOf(page).card.locator('header')).toContainText('· Ducks');

    await goHome(page);
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Readiness' })).toContainText('500 unseen');
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 6 answers, 5 right');
    test.info().annotations.push({ type: 'practice answers', description: answered.join(', ') });
  });

  await test.step('step 7: an exam of 20 answered moving freely, one answer changed, submitted; Progress lists it and 26 answers', async () => {
    await goHome(page);
    await page.getByRole('link', { name: 'Exam', exact: true }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('1 of 20')).toBeVisible();
    const clock = page.getByRole('timer', { name: 'Time left' });
    await expect(clock).toHaveText(/^(30:00|29:\d\d)$/);
    const markers = page.getByRole('navigation', { name: 'Questions' }).getByRole('button');
    await expect(markers).toHaveCount(EXAM_SIZE);
    const marker = (n: number) => page.getByRole('button', { name: `Question ${n}`, exact: true });
    const { option, peek, hint } = cardOf(page);
    await expect(peek).toHaveCount(0);
    await expect(hint).toHaveCount(0);

    // Four wrong (positions 3, 8, 12 and 17), the rest right: 16 out of 20.
    const wrongAt = new Set([3, 8, 12, 17]);
    const ids: number[] = [];
    const choose = async (n: number, key?: OptionKey) => {
      await expect(page.getByText(`${n} of 20`)).toBeVisible();
      const question = questionFor(await shownId(page));
      ids[n - 1] = question.id;
      const picked = key ?? (wrongAt.has(n) ? wrongOf(question) : question.answer);
      await option(picked).click();
      await expect(option(picked)).toHaveAttribute('aria-pressed', 'true');
      await expect(marker(n)).toHaveAttribute('data-answered', 'true');
    };
    const next = page.getByRole('button', { name: 'Next', exact: true });
    const previous = page.getByRole('button', { name: 'Previous', exact: true });

    // 1 to 10 with Next, question 3 answered right at first.
    for (let n = 1; n <= 10; n++) {
      await choose(n, n === 3 ? questionFor(await shownId(page)).answer : undefined);
      if (n < 10) await next.click();
    }
    // Jump to 20 and walk back to 11 with Previous.
    await marker(20).click();
    for (let n = 20; n >= 11; n--) {
      await choose(n);
      if (n > 11) await previous.click();
    }
    // Back to 3 by its marker and change its answer to a wrong one.
    await marker(3).click();
    await choose(3);
    await expect(page.locator('[data-answered="true"]')).toHaveCount(EXAM_SIZE);
    expect(new Set(ids).size).toBe(EXAM_SIZE);

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exam results');
    const score = page.getByRole('region', { name: 'Score' });
    await expect(score).toContainText('16 out of 20');
    await expect(score).toContainText('Passed');
    await expect(score).toContainText('Pass mark 15');
    const wrong = page.getByRole('list', { name: 'Wrong answers' }).locator(':scope > li');
    await expect(wrong).toHaveCount(wrongAt.size);
    for (const [i, n] of [...wrongAt].entries()) {
      const item = wrong.nth(i);
      const question = questionFor(ids[n - 1] ?? 0);
      await expect(item.getByText(`Question ${question.id}`, { exact: true })).toBeVisible();
      const options = item.getByRole('group', { name: 'Options' }).getByRole('button');
      await expect(options.nth(OPTION_KEYS.indexOf(question.answer))).toHaveAttribute('data-mark', 'correct');
      await expect(options.nth(OPTION_KEYS.indexOf(wrongOf(question)))).toHaveAttribute('data-mark', 'wrong');
      await expect(item.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
    }
    await wrong.first().getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(wrong.first().getByRole('region', { name: 'Hint' })).toBeVisible();

    await goHome(page);
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    const past = page.getByRole('region', { name: 'Past exams' }).getByRole('link');
    await expect(past).toHaveCount(1);
    await expect(past).toHaveAccessibleName(/: 16 of 20, Passed$/);
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 26 answers, 21 right');
  });

  await test.step('step 8: a second exam with 3 answers survives closing the tab, its clock still running', async () => {
    await goHome(page);
    await page.getByRole('link', { name: 'Exam', exact: true }).click();
    const startClicked = Date.now();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('1 of 20')).toBeVisible();
    const startShown = Date.now();
    const chosen: OptionKey[] = ['A', 'B', 'C'];
    for (const [i, key] of chosen.entries()) {
      await expect(page.getByText(`${i + 1} of 20`)).toBeVisible();
      await cardOf(page).option(key).click();
      await expect(page.getByRole('button', { name: `Question ${i + 1}`, exact: true })).toHaveAttribute('data-answered', 'true');
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await page.close();

    // The app stays closed for three minutes, which the clock must have counted when it is opened again.
    page = await context.newPage();
    await context.clock.fastForward(CLOSED_MS);
    const reopened = Date.now() + CLOSED_MS;
    await page.goto('./');
    await expect(examCard(page)).toContainText(/^Exam in progress27 minutes left$/);
    await examCard(page).click();

    const markers = page.getByRole('navigation', { name: 'Questions' });
    await expect(markers.locator('[data-answered="true"]')).toHaveCount(3);
    for (const [i, key] of chosen.entries()) {
      await page.getByRole('button', { name: `Question ${i + 1}`, exact: true }).click();
      await expect(page.getByText(`${i + 1} of 20`)).toBeVisible();
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

  await test.step('step 9: Flagged holds the one hint flag; Copy puts the header and its line; clearing it leaves none', async () => {
    await goHome(page);
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
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

  await test.step('step 10: Export, clear, import: the same readiness, exam card, 26 answers and 1 past exam come back', async () => {
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
    expect(exported.answers).toHaveLength(26);
    expect(exported.exams).toHaveLength(2);
    expect(exported.exams.filter((exam) => exam.finishedAt !== undefined)).toHaveLength(1);
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
    await expect(page.getByRole('status')).toHaveText('Added 26 answers, 2 exams and 0 flags');

    await goHome(page);
    expect(await homeReadiness(page)).toEqual(before);
    await expect(examCard(page)).toBeVisible();
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(page.getByText(/^Today: /)).toHaveText('Today: 26 answers, 21 right');
    await expect(page.getByRole('region', { name: 'Past exams' }).getByRole('link')).toHaveCount(1);
  });

  await test.step('step 11: Português turns Home, Practice and Settings Portuguese, survives a reload, and English comes back', async () => {
    await goHome(page);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Português' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
    await expect(page.getByRole('group', { name: 'Idioma' })).toBeVisible();
    for (const name of ['Exportar', 'Importar', 'Limpar o progresso']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Definições');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');

    await page.getByRole('link', { name: 'Voltar ao início' }).click();
    await expect(page.getByRole('main').getByRole('link')).toContainText(['Praticar', 'Exame', 'Progresso', 'Definições']);
    await expect(page.getByText(/^\d+ por ver$/)).toBeVisible();

    await page.getByRole('link', { name: 'Praticar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Praticar');
    const id = Number((await page.getByRole('article').getByText(/^Pergunta \d+$/).textContent())?.replace('Pergunta ', ''));
    const question = questionFor(id);
    const card = page.getByRole('article');
    await expect(card.locator('header')).toContainText(`${sectionOf(question)?.pt} · ${topicOf(question)?.pt}`);
    await expect(card.getByRole('group', { name: 'Opções' }).getByRole('button')).toHaveCount(3);
    await expect(card.getByRole('button', { name: 'Manter premido para ver em inglês' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Dica', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Voltar ao início' }).click();
    await page.getByRole('link', { name: 'Definições', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await goHome(page);
    await expect(page.getByRole('main').getByRole('link')).toContainText(['Practice', 'Exam', 'Progress', 'Settings']);
  });
});
