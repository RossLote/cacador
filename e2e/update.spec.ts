import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// vite preview reads dist from disk on each request, so a changed sw.js there is a deploy to every page it serves.
const swFile = path.resolve(import.meta.dirname, '../apps/web/dist/sw.js');

declare global {
  interface Window {
    /** Set on the page's window by the test; only a load of the page clears it. */
    unreloaded?: true;
    tookOver?: Promise<void>;
  }
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });
const questionNumber = (page: Page) => page.getByRole('main').locator('header').getByText(/^Question \d+$/);

async function mark(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.unreloaded = true;
  });
}

/** Whether the page is still the one marked, after a pause long enough for a reload to replace it (which would fail the evaluate). */
function stillMarked(page: Page): Promise<boolean> {
  return page.evaluate(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(window.unreloaded === true), 500)));
}

// cac-eno, amending phase 4 D12: a new worker takes over as soon as it has installed, the app checks for one each time
// it comes back to the foreground, and the page reloads at the next change of screen, never on the screen in use.
test('cac-eno: a deploy reaches the open app at its next change of screen, never on the screen in use', async ({ page }) => {
  const deployed = readFileSync(swFile, 'utf8');
  try {
    await page.goto('./');
    // The first worker claims the page that loaded without one. That is not an update, so a change of screen stays in
    // the same page.
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await mark(page);
    await tab(page, 'Practice').click();
    await expect(questionNumber(page)).toBeVisible();
    expect(await stillMarked(page), 'a change of screen with no update').toBe(true);
    const question = await questionNumber(page).textContent();

    // The next deploy, and the app coming back to the foreground, which is when it checks for one.
    writeFileSync(swFile, `${deployed}\n// e2e: the next deploy\n`);
    await page.evaluate(() => {
      window.tookOver = new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => window.tookOver);

    // The new worker controls the page, and the screen in use stays as it is, on the same question.
    expect(await stillMarked(page), 'the screen in use when the new worker took over').toBe(true);
    await expect(questionNumber(page)).toHaveText(question!);

    // The next change of screen loads the page again, from the new worker.
    const loaded = page.waitForEvent('load');
    await tab(page, 'Home').click();
    await loaded;
    await expect(page.getByRole('heading', { level: 1, name: 'Caçador' })).toBeVisible();
    expect(await page.evaluate(() => window.unreloaded)).toBeUndefined();

    // That page is the new build, so the change of screen after it stays in the page.
    await mark(page);
    await tab(page, 'Practice').click();
    await expect(questionNumber(page)).toBeVisible();
    expect(await stillMarked(page), 'a change of screen after the update').toBe(true);
  } finally {
    writeFileSync(swFile, deployed);
  }
});
