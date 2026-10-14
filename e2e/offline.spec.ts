import { expect, test } from '@playwright/test';
import { manifest } from '@cacador/data';
import { expectFraunces } from './look';

// Phase 4 D12, ACCEPTANCE BAR step 10 (epic cac-8cn): after one online load and a reload, the app opens with its fonts
// and shows every picture with no network. The first load installs the service worker; it has no clientsClaim, so
// only the reload is controlled by it.
const imageStems = manifest.images.map((image) => image.file.replace(/\.jpg$/, '')).sort();

test('step 10: offline, after one online visit, Home and Practice render from the cache with Fraunces available and the 15 pictures still load', async ({
  page,
  context,
}) => {
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

  // Every font file the pages fetch offline, and whether the service worker answered it.
  const fonts: Array<{ url: string; fromServiceWorker: boolean; status: number }> = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2')) {
      fonts.push({ url: response.url(), fromServiceWorker: response.fromServiceWorker(), status: response.status() });
    }
  });

  for (const route of ['./', 'practice']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    expect(response?.fromServiceWorker(), route).toBe(true);
    await expect(page.locator('#root'), route).not.toBeEmpty();
    await expect(page.getByRole('heading', { level: 1 }).first(), route).toBeVisible();
    if (route === './') await expectFraunces(page, page.getByRole('heading', { level: 1, name: 'Caçador' }));
  }
  // Practice shows a question: its number in the screen header, its stem in Fraunces and three options on the card.
  await expect(page.getByRole('main').locator('header').getByText(/^Question \d+$/)).toBeVisible();
  const card = page.getByRole('article');
  await expect(card.getByRole('group', { name: 'Options' }).getByRole('button')).toHaveCount(3);
  await expectFraunces(page, card.locator(':scope > p[lang]'));
  expect(fonts.length, 'font files fetched offline').toBeGreaterThan(0);
  for (const font of fonts) {
    expect(font.url, 'a font from the app').toMatch(/^http:\/\/localhost:\d+\/cacador\/assets\/[\w-]+\.woff2$/);
    expect(font, font.url).toMatchObject({ fromServiceWorker: true, status: 200 });
  }

  const statuses = await page.evaluate(
    (urls) => Promise.all(urls.map(async (url) => [url, (await fetch(url)).status] as const)),
    imageUrls,
  );
  expect(statuses).toEqual(imageUrls.map((url) => [url, 200]));
});
