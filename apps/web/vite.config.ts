/// <reference types="vitest/config" />
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages answers an unknown path with 404.html, so a sub-route opened before the service worker controls the
// page (a first visit, or a link to /cacador/practice) still boots the app when 404.html is index.html (phase 4 D1).
function githubPagesFallback(): Plugin {
  let outDir = '';
  return {
    name: 'cacador:github-pages-404',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      await copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}

// The app is served from /cacador/ on GitHub Pages (DESIGN.md, phase 4 D1); the router basename matches.
export default defineConfig({
  base: '/cacador/',
  plugins: [
    react(),
    tailwindcss(),
    githubPagesFallback(),
    // Installable and offline (phase 4 D12). The manifest is public/manifest.webmanifest, linked from index.html.
    VitePWA({
      strategies: 'generateSW',
      // src/pwa/registerServiceWorker.ts registers the worker from main.tsx; the plugin injects nothing.
      injectRegister: false,
      // 'prompt' is the mode that leaves skipWaiting and clientsClaim off ('autoUpdate' forces both on). No prompt is
      // shown: nothing listens for the waiting worker, which takes over on the next cold open of the app.
      registerType: 'prompt',
      manifest: false,
      scope: '/cacador/',
      // Say so in the build output if a file is ever left out of the precache for its size.
      showMaximumFileSizeToCacheInBytesWarning: true,
      workbox: {
        // Everything in dist: the shell, the JS (the question bank is in it), the css, the 15 pictures from the
        // image map, the icons and the manifest.
        globPatterns: ['**/*.{html,js,css,webmanifest,png,svg,jpg}'],
        // The question bank rides in the main JS chunk: about 0.56 MB of JSON, so the chunk stays near 1 MB, under
        // workbox's 2 MiB default. The ceiling is raised to 4 MiB so growth never silently drops it from the precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Root-relative precache URLs, so every URL the worker holds starts with /cacador/. The hashed files under
        // assets/ carry their revision in the name, so the worker does not add one.
        modifyURLPrefix: { '': '/cacador/' },
        dontCacheBustURLsMatching: /^\/cacador\/assets\//,
        navigateFallback: '/cacador/index.html',
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
});
