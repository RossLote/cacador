// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { manifest } from '@cacador/data';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import appConfig from '../../vite.config';
import { imageUrl } from './images';

const files = manifest.images.map((image) => image.file);
const stem = (file: string) => file.replace(/\.jpg$/, '');

describe('imageUrl', () => {
  it('has a URL for every picture the data manifest lists, and nothing for a name it does not', () => {
    expect(files).toHaveLength(15);
    for (const file of files) expect(imageUrl(file), file).toContain(stem(file));
    expect(new Set(files.map(imageUrl)).size).toBe(15);

    expect(imageUrl('q999.jpg')).toBeUndefined();
    expect(imageUrl('q119')).toBeUndefined();
    expect(imageUrl('')).toBeUndefined();
    expect(imageUrl('constructor')).toBeUndefined();
  });

  // Vitest serves modules from / whatever the config says, so the /cacador/ URLs are proved on a real build of the
  // image map with the app's base, the way `pnpm build` resolves @cacador/data/images/* through the package export.
  describe('in a build with the app base', () => {
    let outDir = '';
    afterAll(async () => {
      if (outDir) await rm(outDir, { recursive: true, force: true });
    });

    it('resolves every picture to a hashed file under /cacador/assets/ that the build emits', async () => {
      expect(appConfig.base).toBe('/cacador/');
      outDir = await mkdtemp(path.join(tmpdir(), 'cacador-image-map-'));
      await build({
        configFile: false,
        logLevel: 'silent',
        root: path.resolve(import.meta.dirname, '../..'),
        base: appConfig.base,
        build: {
          outDir,
          emptyOutDir: true,
          rollupOptions: {
            input: path.resolve(import.meta.dirname, 'images.ts'),
            preserveEntrySignatures: 'strict',
            output: { entryFileNames: 'images.js' },
          },
        },
      });
      const built = (await import(pathToFileURL(path.join(outDir, 'images.js')).href)) as typeof import('./images');

      for (const file of files) {
        const url = built.imageUrl(file);
        expect(url, file).toMatch(new RegExp(`^/cacador/assets/${stem(file)}-[\\w-]+\\.jpg$`));
        expect(existsSync(path.join(outDir, url!.slice('/cacador/'.length))), url).toBe(true);
      }
      expect(built.imageUrl('q999.jpg')).toBeUndefined();
    });
  });
});
