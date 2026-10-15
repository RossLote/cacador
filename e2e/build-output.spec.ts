import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// The production build the web server has just made (playwright.config.ts builds before it serves). These rules live in
// the files GitHub Pages serves, and vite preview hides some of them (its own SPA fallback answers any sub-route), so
// they are read from dist, not over the network.
const dist = path.resolve(import.meta.dirname, '../apps/web/dist');
const read = (file: string) => readFileSync(path.join(dist, file), 'utf8');
// Listed inside each test, not at load: the runner loads this file to collect the tests before the web server builds.
function distFiles(): string[] {
  return readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dist, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}
const isWorkbox = (file: string) => /^workbox-[\w-]+\.js$/.test(file);

function precacheUrls(): string[] {
  const list = /\.precacheAndRoute\((\[[^\]]*\])/.exec(read('sw.js'))?.[1];
  expect(list, 'the precacheAndRoute list in sw.js').toBeDefined();
  return [...list!.matchAll(/\{url:"([^"]+)",revision:/g)].map((match) => match[1]!);
}

test('D1: 404.html is byte-identical to index.html, so GitHub Pages boots the app on any sub-route', () => {
  expect(distFiles()).toContain('404.html');
  const index = readFileSync(path.join(dist, 'index.html'));
  const notFound = readFileSync(path.join(dist, '404.html'));
  expect(notFound.equals(index), '404.html differs from index.html').toBe(true);
});

// cac-eno, amending D12: a new worker takes over as soon as it has installed, so a deploy never waits on every window of
// the installed app closing; with skipWaiting on, generateSW writes no SKIP_WAITING listener for a page to call.
test('D12: a new service worker skips waiting and claims the open pages unasked', () => {
  const sw = read('sw.js');
  expect(sw.match(/.{0,40}self\.skipWaiting\(\),\w+\.clientsClaim\(\).{0,40}/g), 'sw.js').toHaveLength(1);
  expect(sw.match(/.{0,60}SKIP_WAITING.{0,20}/g), 'sw.js').toBeNull();
});

test('D12: the precache holds every built file, the manifest and index.html among them, all under /cacador/', () => {
  const urls = precacheUrls();
  for (const url of urls) expect(url, 'precache').toMatch(/^\/cacador\//);
  expect(urls).toEqual(expect.arrayContaining(['/cacador/manifest.webmanifest', '/cacador/index.html']));

  const expected = distFiles()
    .filter((file) => file !== 'sw.js' && !isWorkbox(file))
    .map((file) => `/cacador/${file}`);
  expect([...urls].sort()).toEqual(expected.sort());
});

// ACCEPTANCE BAR step 11 (epic cac-8cn D3): the two self-hosted fonts, latin and latin-ext each, and the 15 pictures
// are precached under the base path, and nothing the app serves points at a font host.
test('step 11: the precache holds exactly 4 woff2 URLs and the 15 jpg URLs, every URL under /cacador/; no URL points at a font host', () => {
  const urls = precacheUrls();
  for (const url of urls) expect(url, 'precache').toMatch(/^\/cacador\//);
  const fonts = urls.filter((url) => url.endsWith('.woff2'));
  expect(fonts).toHaveLength(4);
  // Each URL is named by the one font file it starts with. Vite's content hash may itself hold a '-', so the name is
  // matched as a prefix rather than cut at the last '-'; no name is a prefix of another followed by '-'.
  const fontFiles = [
    'fraunces-latin-ext-opsz-normal',
    'fraunces-latin-opsz-normal',
    'source-sans-3-latin-ext-wght-normal',
    'source-sans-3-latin-wght-normal',
  ];
  const fontFile = (url: string) => fontFiles.find((name) => url.startsWith(`/cacador/assets/${name}-`)) ?? url;
  for (const url of fonts) expect(url, 'a hashed font file under assets/').toMatch(/^\/cacador\/assets\/[\w-]+\.woff2$/);
  expect(fonts.map(fontFile).sort()).toEqual(fontFiles);
  expect(urls.filter((url) => url.endsWith('.jpg'))).toHaveLength(15);
  expect(distFiles().filter((file) => file.endsWith('.woff2')), 'font files in dist').toHaveLength(4);

  // Every font the CSS declares is one of the four, by its built URL.
  const css = distFiles().filter((file) => file.endsWith('.css'));
  expect(css.length).toBeGreaterThan(0);
  const fontSources = css.flatMap((file) =>
    [...read(file).matchAll(/@font-face\{[^}]*\}/g)].flatMap((face) => [...face[0].matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!)),
  );
  expect([...new Set(fontSources)].sort()).toEqual([...fonts].sort());

  // No font host anywhere in what is served: index.html, the CSS, the JS and the service worker.
  const fontHost = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fontsource\.org|cdn\.jsdelivr\.net/;
  for (const file of distFiles().filter((name) => /\.(html|css|js|webmanifest)$/.test(name))) {
    expect(read(file).match(new RegExp(`.{0,40}(?:${fontHost.source}).{0,40}`, 'g')), file).toBeNull();
  }
});

// The manifest's own URLs are checked where it is served (installable.spec.ts).
test('D1: every URL in index.html starts with /cacador/', () => {
  const html = read('index.html');
  const htmlUrls = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1]!);
  expect(htmlUrls.length).toBeGreaterThan(0);
  for (const url of htmlUrls) expect(url, 'index.html').toMatch(/^\/cacador\//);
});
