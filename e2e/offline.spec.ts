import { expect, test } from '@playwright/test';
import { manifest } from '@cacador/data';

// Phase 4 D12, ACCEPTANCE BAR step 12: after one online load and a reload, the app opens and shows every picture with
// no network. The first load installs the service worker; it has no clientsClaim, so only the reload is controlled by it.
const imageStems = manifest.images.map((image) => image.file.replace(/\.jpg$/, '')).sort();

test('step 12: offline, Home opens, Practice shows a question and all 15 pictures answer from the cache', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  // The pictures' built URLs, read from the worker's own precache list while still online.
  const sw = await page.evaluate(async () => (await fetch('/cacador/sw.js')).text());
  const imageUrls = [...new Set(sw.match(/\/cacador\/assets\/[\w-]+\.jpg/g) ?? [])];
  expect(imageUrls).toHaveLength(15);
  expect(imageUrls.map((url) => url.replace(/^\/cacador\/assets\/([a-z0-9]+)-.*$/, '$1')).sort()).toEqual(imageStems);

  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  for (const route of ['./', 'practice']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    expect(response?.fromServiceWorker(), route).toBe(true);
    await expect(page.locator('#root'), route).not.toBeEmpty();
    await expect(page.getByRole('heading', { level: 1 }).first(), route).toBeVisible();
  }
  // Practice shows a question: its number and three options on the card.
  const card = page.getByRole('article');
  await expect(card.getByText(/^Question \d+$/)).toBeVisible();
  await expect(card.getByRole('group', { name: 'Options' }).getByRole('button')).toHaveCount(3);

  const statuses = await page.evaluate(
    (urls) => Promise.all(urls.map(async (url) => [url, (await fetch(url)).status] as const)),
    imageUrls,
  );
  expect(statuses).toEqual(imageUrls.map((url) => [url, 200]));
});
