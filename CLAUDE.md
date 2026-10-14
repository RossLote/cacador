# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## Project

Caçador: a personal practice app for the Portuguese hunting licence theory exam
(carta de caçador, run by ICNF). One learner, who reads English and is learning
Portuguese. The official bank of 506 questions is answered in Portuguese; the app
shows the English only while a button is held, keeps a per-question history on the
device, weights what was recently wrong toward the front of the next practice, and
runs 20-question, 30-minute mock exams with a pass line at 75 %. It is a static,
installable, offline web app in `apps/web` with no backend, served by GitHub Pages at
https://rosslote.github.io/cacador/; progress stays on the device in IndexedDB.

Product rules and the settled decisions live in `DESIGN.md`; where this file and
`DESIGN.md` disagree, `DESIGN.md` § Decision record wins. Work is tracked in beads
(prefix `cac`); the JSONL export in `.beads/issues.jsonl` is committed with every
change because there is no Dolt remote.

This is a personal project: no pull requests, no recorded walkthroughs; the push to
`main` is the deploy. A bead is done when its acceptance holds and `pnpm lint` and
`pnpm test` are green.

## Build & Test

Runtime is Node 26 via nvm (`.nvmrc` holds `26`) and pnpm 11 (`packageManager` in
the root `package.json`). Corepack is not used. The extraction scripts shell out to
`pdftotext` and `pdfimages` from poppler (`brew install poppler`).

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm install
pnpm dev       # apps/web: the Vite dev server, the app under /cacador/
pnpm build     # apps/web: the production build into apps/web/dist
pnpm lint      # eslint . --max-warnings 0, then tsc --noEmit in every workspace, then pnpm validate,
               # then node scripts/check-no-radix.mjs (the Radix check)
pnpm test      # vitest run in packages/data and apps/web
pnpm e2e:browsers  # e2e: Chromium and its headless shell, once before pnpm e2e and after each Playwright bump
pnpm e2e       # e2e: Playwright against vite preview of the production build; not part of lint or test
pnpm extract   # packages/data: rebuild the question files from the source PDF
pnpm validate  # packages/data: check the manifest and the question files (also part of lint)
```

Every workspace package defines `typecheck` (`tsc -p tsconfig.json`, which never
emits because `tsconfig.base.json` sets `noEmit`), and the root runs it with
`pnpm -r typecheck`. `packages/data` and `apps/web` define `test` (`vitest run`),
which the root runs with `pnpm -r test`; `e2e` defines `e2e` (plain `playwright
test`, never `--pass-with-no-tests`) instead of `test`, so `pnpm test` passes over it
and `pnpm e2e` calls it with `pnpm --filter @cacador/e2e`. `apps/web` also defines
`dev`, `build` and `preview`, which `pnpm dev` and `pnpm build` call with
`pnpm --filter @cacador/web`. `packages/data` also defines `extract` and `validate`,
which the root scripts call with `pnpm --filter @cacador/data`. The e2e web server
builds `apps/web` and serves it with `vite preview` on port 4173 (`E2E_PORT`
overrides it) under `/cacador/`, browser locale `en-GB`.

Deploy: `.github/workflows/deploy.yml` runs on every push to `main`: install (Node
from `.nvmrc`, pnpm from `packageManager`, frozen lockfile), lint, test and build,
then deploys `apps/web/dist` to GitHub Pages with the default token. Ross enables
Pages once in the repository settings (Pages, Source: GitHub Actions) before the
first push. Nothing else deploys, and e2e is not in the workflow.

## Architecture Overview

pnpm workspace of three packages: `packages/data`, `apps/web` and `e2e`
(`pnpm-workspace.yaml` lists `packages/*`, `apps/*` and `e2e`).

- `packages/data`: the question bank as data. `source/` holds the official PDF and a
  reference parse; `questions/` holds the Portuguese questions in 18 chunk files, one
  section or species group each, never more than 51 questions; `translations/en/` and
  `hints/en/` mirror those file names; `images/` holds the 14 species photos and
  `sinal.jpg`, the sign shared by four questions; `glossary/` holds species and term
  lists; `manifest.json` lists sections, topics and chunks with their id ranges. `scripts/extract.mjs` and `scripts/validate.mjs` build
  and check it. `src/index.ts` is the typed loader the app imports. The layout and
  shapes are fixed in `DESIGN.md` § 3 and § 4.
- `apps/web` (`@cacador/web`): Vite 8 with base `/cacador/`, React 19, TypeScript,
  Tailwind v4 with the Campo light and dark tokens following `prefers-color-scheme`,
  Fraunces and Source Sans 3 self-hosted from Fontsource (four woff2 files, precached),
  shadcn/ui style `base-nova` on `@base-ui/react` (the generated components in
  `src/components/ui/`). `src/main.tsx` mounts `BrowserRouter` with the basename from
  `import.meta.env.BASE_URL`; `src/App.tsx` holds the routes (`/`, `/practice`,
  `/exam/*`, `/progress`, `/settings`, `/flagged`, and a not-found page for any other
  address) and the shared layout. The menu is a bottom tab bar (Home, Practice, Exam,
  Progress) on every screen but the `/exam` route; every screen but Home opens with a
  screen header holding the back control to Home. Under `src/`:
  - one folder per screen, each with its page and its tests: `home` (the header with
    the Settings control, readiness, the exam-in-progress card, the Practice and Exam
    cards, Weakest topics), `practice` (the session, the flags row,
    the laptop keys, the focused-practice pool from the query and `recent.ts`, the
    draw over the no-repeat window), `exam` (`ExamPage` owns the sub-routes:
    `/exam` starts or resumes the running exam, `/exam/results/<id>` the results and
    review), `progress` (the day bars, the topic, section and pattern lists, past
    exams), `settings` (language, export and share, import, clear), `flagged` (the list,
    `FlaggedLink`, the row to it on Progress and Settings, and `copyFormat.ts`, the fixed
    copy text) and `notfound` (the page for an address that names no screen);
  - `components/nav/`: the tab bar and the screen header with the back control;
    `components/question/`: the question card, a controlled component with the peek
    button and the hint panel, shared by practice and the exam; `components/styles.ts`:
    the shared class strings (`FOCUS_RING`, `PLATE`, `CHIP`, `ROW_LINK`);
    `components/ui/`: the generated shadcn components;
  - `model/`: the study model, pure functions for the draw weights and the no-repeat
    window, readiness, group accuracy, the day bars, the pools and the exam draw,
    deadline and score;
  - `storage/`: the storage module, the only code that touches IndexedDB. `index.ts`
    is the API every screen uses, over an IndexedDB backend and a memory fallback
    with the same behaviour; it also holds the record and export types (`types.ts`),
    the two browser key names (`keys.ts`), the exam finish (`finish.ts`), the import
    merge (`merge.ts`), the export file (`exportFile.ts`) and the no-repeat window in
    sessionStorage, kept in memory when that is blocked (`recent.ts`);
  - `pwa/`: the image map that puts the 15 pictures in `dist` and the precache, and
    `registerServiceWorker.ts`, which registers vite-plugin-pwa's service worker by
    hand;
  - `i18n/`: the language store (`locale.ts`, `useI18n.ts`) and `messages/en/` and
    `messages/pt/`, one file per screen plus `common`;
  - `lib/utils.ts`: the `cn` helper the shadcn components use.

  `public/` holds the web manifest and the icons, rendered from `public/favicon.svg`
  by `scripts/render-icons.sh`. `DESIGN.md` § 6 to § 8.
- `e2e` (`@cacador/e2e`): the Playwright suite in Chromium, run by `pnpm e2e` against
  the production build served by `vite preview` under `/cacador/`, with `@cacador/data`
  for the bank, at a 390 x 844 viewport (the Campo bar is performed at a phone's width).
  `acceptance.spec.ts` performs steps 2 to 9 of the Campo acceptance bar (epic cac-8cn)
  in order and then four steps after the bar (an exam passed from the bank's key, the
  closed-tab exam, the past exams and Flagged, export, clear and import); `offline.spec.ts` is step 10 (Home, Practice,
  Fraunces from the cache and the 15 images); `build-output.spec.ts` reads the built
  `dist` (the `404.html` copy, the waiting service worker, the `/cacador/` precache and
  URLs) and carries step 11 (exactly four woff2 and the 15 jpg precache URLs, no font
  host); `e2e/look.ts` holds the Campo colour values, the contrast helper and the
  Fraunces check; `installable.spec.ts` runs Chrome's installability check.
  `pnpm e2e:browsers` installs the browser.
  `DESIGN.md` § 8.10.

Outside the workspace, `design/campo/` holds the design reference: the Campo style tile
and one artboard each for Home, Practice, the exam and Progress, with a README; read for
values, never built. `DESIGN.md` § 8.5 wins where they disagree.

## Conventions & Patterns

- Portuguese question files are the source of truth and are only ever written by
  `scripts/extract.mjs`; hand edits go into the script's correction table so a rerun
  reproduces them. English and hints are hand-maintained files that mirror the ids.
- A chunk file never spans two sections, and no file holds more than 51 questions.
  Agents work one chunk file at a time; a bead names the files it owns in TOUCHES.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (three days), strict. Never add
  an exclusion; if a version is too new, use the previous one.
- UI components come from shadcn/ui on Base UI (`apps/web/src/components/ui/`). Radix
  is banned: ESLint's `no-restricted-imports` and `scripts/check-no-radix.mjs` enforce
  it inside `pnpm lint`.
- The look is Campo (`DESIGN.md` § 8.5, reference `design/campo/`): the paper ground,
  ink, forest and rust tokens in light and dark, keyed on `prefers-color-scheme`, never
  a class; Fraunces 600 for the stems, titles and headline numbers and Source Sans 3 for
  the rest, self-hosted as exactly four woff2 files in the precache, never from Google
  Fonts or any font host; hairlines and plates, no shadows, no pill buttons, lucide
  icons, never emoji. The menu is the bottom tab bar of four tabs.
- No user-facing text in components; strings live in the i18n messages files, English
  and European Portuguese (`pt-PT`, never Brazilian). The one exception is the Flagged
  page's copy format (`Caçador flags <date>`, `#<id> English: <note>`), a fixed English
  text for an agent to read, kept as constants in one module (`DESIGN.md` § 6.7).
- Messages are split per screen: `apps/web/src/i18n/messages/en/<screen>.ts` and
  `pt/<screen>.ts`. A screen's bead edits only its own two files and duplicates a shared
  word rather than editing `common`; the Portuguese is typed by the English, so a
  missing key fails `pnpm lint`.
- Hot files have one owner: the scaffold lands them, and no bead running beside another
  edits the root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `eslint.config.js`, `.gitignore`, `scripts/check-no-radix.mjs`, `e2e/package.json`,
  or in `apps/web` the `package.json`, `components.json`, `tsconfig.json`,
  `src/App.tsx`, `src/index.css`, `src/components/ui/**`, the i18n store and index files
  and `src/storage/types.ts`. A change to one of them, and a new dependency, route or
  screen, is a bead or pass of its own that names the files in its TOUCHES while no
  other worker holds them (`DESIGN.md` § 8.4).
- Browser storage keys start with `cacador.`. There are two, `cacador.locale` in
  localStorage and `cacador.recent` in sessionStorage; their names come from
  `apps/web/src/storage/keys.ts`, and nothing outside `apps/web/src/storage/` touches
  IndexedDB.
- Species names in English follow `packages/data/glossary/species.json`, never a
  translator's guess; the validator enforces it (`DESIGN.md` § 4 rule 6).
