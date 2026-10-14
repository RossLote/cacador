import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets parallel worktrees run the suite at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173);
// The app lives under /cacador/ (phase 4 D1); specs navigate relative to it, e.g. page.goto('practice').
const baseURL = `http://localhost:${PORT}/cacador/`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // The specs read English text whatever the machine's locale.
    locale: 'en-GB',
    trace: 'retain-on-failure',
  },
  // The acceptance bar is performed at a phone's width (epic cac-8cn): 390 px wide.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  // Always the production build, served by vite preview with the base path, as deployed.
  webServer: {
    command: `pnpm --filter @cacador/web build && pnpm --filter @cacador/web preview --port ${PORT} --strictPort`,
    cwd: '..',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
