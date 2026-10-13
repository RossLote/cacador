import { expect, test } from '@playwright/test';

// Chrome's installability check (what its Install menu item and Lighthouse's audit use) lives in the browser, not in
// the headless shell, which answers "no errors" for any page, a page with no manifest included. This file runs in the
// full Chromium build, which `playwright install chromium` installs beside the shell.
test.use({ channel: 'chromium' });

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

test('the app is installable: the manifest, its icons and the favicons are served under /cacador/', async ({
  page,
  request,
}) => {
  await page.goto('./');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('/cacador/manifest.webmanifest');
  const manifestResponse = await request.get(manifestHref!);
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = (await manifestResponse.json()) as { icons: ManifestIcon[] };
  expect(manifest).toMatchObject({
    id: '/cacador/',
    name: 'Caçador',
    short_name: 'Caçador',
    start_url: '/cacador/',
    scope: '/cacador/',
    display: 'standalone',
    lang: 'en',
    theme_color: '#14301f',
    background_color: '#14301f',
  });
  const sizes = manifest.icons.filter((icon) => !icon.purpose).map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(true);
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\/cacador\//);
    const file = await request.get(icon.src);
    expect(file.status(), icon.src).toBe(200);
    expect(file.headers()['content-type'], icon.src).toBe(icon.type);
  }

  const links = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').all();
  expect(links).toHaveLength(3);
  for (const link of links) {
    const href = (await link.getAttribute('href'))!;
    expect(href).toMatch(/^\/cacador\//);
    const file = await request.get(href);
    expect(file.status(), href).toBe(200);
    expect(file.headers()['content-type'], href).toMatch(/^image\//);
  }
});

test('Chrome parses the manifest with its icons and finds nothing in the way of Install', async ({ page }) => {
  await page.goto('./');
  const cdp = await page.context().newCDPSession(page);

  const { url, errors, manifest } = await cdp.send('Page.getAppManifest');
  expect(url).toMatch(/\/cacador\/manifest\.webmanifest$/);
  expect(errors).toEqual([]);
  expect(manifest?.icons?.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);

  // Every Playwright context is incognito, which Chrome reports as one more reason; nothing else may be missing.
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors.filter((error) => error.errorId !== 'in-incognito')).toEqual([]);
});
