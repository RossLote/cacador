// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { animals } from '@cacador/data';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import appConfig from '../../vite.config';
import { animalImageUrl } from './animalImages';

const slugs = animals.map((animal) => animal.slug);

describe('animalImageUrl', () => {
  it('has a URL for every animal the data lists, and nothing for a slug it does not', () => {
    expect(slugs).toHaveLength(19);
    for (const slug of slugs) expect(animalImageUrl(slug), slug).toContain(slug);
    expect(new Set(slugs.map(animalImageUrl)).size).toBe(19);

    expect(animalImageUrl('nope')).toBeUndefined();
    expect(animalImageUrl('javali.jpg')).toBeUndefined();
    expect(animalImageUrl('')).toBeUndefined();
    expect(animalImageUrl('constructor')).toBeUndefined();
  });

  // Vitest serves modules from / whatever the config says, so the /cacador/ URLs are proved on a real build of the
  // photo map with the app's base, the way `pnpm build` resolves @cacador/data/animals/* through the package export.
  describe('in a build with the app base', () => {
    let outDir = '';
    afterAll(async () => {
      if (outDir) await rm(outDir, { recursive: true, force: true });
    });

    it('resolves every photo to a hashed file under /cacador/assets/ that the build emits', async () => {
      expect(appConfig.base).toBe('/cacador/');
      outDir = await mkdtemp(path.join(tmpdir(), 'cacador-animal-image-map-'));
      await build({
        configFile: false,
        logLevel: 'silent',
        root: path.resolve(import.meta.dirname, '../..'),
        base: appConfig.base,
        build: {
          outDir,
          emptyOutDir: true,
          rollupOptions: {
            input: path.resolve(import.meta.dirname, 'animalImages.ts'),
            preserveEntrySignatures: 'strict',
            output: { entryFileNames: 'animalImages.js' },
          },
        },
      });
      const built = (await import(pathToFileURL(path.join(outDir, 'animalImages.js')).href)) as typeof import('./animalImages');

      const urls = slugs.map((slug) => built.animalImageUrl(slug));
      for (const [i, slug] of slugs.entries()) {
        const url = urls[i];
        expect(url, slug).toMatch(new RegExp(`^/cacador/assets/${slug}-[\\w-]+\\.jpg$`));
        expect(existsSync(path.join(outDir, url!.slice('/cacador/'.length))), url).toBe(true);
      }
      expect(new Set(urls).size).toBe(19);
      expect(built.animalImageUrl('nope')).toBeUndefined();
    });
  });
});
