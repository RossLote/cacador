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
  Tailwind v4 with light and dark tokens following `prefers-color-scheme`, shadcn/ui
  style `base-nova` on `@base-ui/react` (the generated components in
  `src/components/ui/`). `src/main.tsx` mounts `BrowserRouter` with the basename from
  `import.meta.env.BASE_URL`; `src/App.tsx` holds the routes (`/`, `/practice`,
  `/exam/*`, `/progress`, `/settings`, `/flagged`) and the shared layout with the back
  control to Home. One folder per screen (`home`, `practice`, `exam`, `progress`,
  `settings`, `flagged`). `src/i18n/` holds the language store (`locale.ts`,
  `useI18n.ts`) and `messages/en/` and `messages/pt/`, one file per screen plus
  `common`. `src/storage/` holds the record and export types (`types.ts`), the two
  browser key names (`keys.ts`); the scaffold landed those and a placeholder page per
  screen. Phase 4's beads add the storage module there, the only code that touches
  IndexedDB (cac-eil.3), `src/model/` the study model (cac-eil.4),
  `src/components/question/` the question card (cac-eil.6), and `src/pwa/` the image
  map with the vite-plugin-pwa service worker that makes it installable and offline
  (cac-eil.5). `DESIGN.md` § 6 to § 8.
- `e2e` (`@cacador/e2e`): the Playwright suite, run by `pnpm e2e` against the
  production build served by `vite preview` under `/cacador/`. The scaffold landed
  `package.json`, `playwright.config.ts` and `tsconfig.json`; the specs arrive with
  cac-eil.5 and cac-eil.11. `DESIGN.md` § 8.10.

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
- No user-facing text in components; strings live in the i18n messages files, English
  and European Portuguese (`pt-PT`, never Brazilian). The one exception is the Flagged
  page's copy format (`Caçador flags <date>`, `#<id> English: <note>`), a fixed English
  text for an agent to read, kept as constants in one module (`DESIGN.md` § 6.7).
- Messages are split per screen: `apps/web/src/i18n/messages/en/<screen>.ts` and
  `pt/<screen>.ts`. A screen's bead edits only its own two files and duplicates a shared
  word rather than editing `common`; the Portuguese is typed by the English, so a
  missing key fails `pnpm lint`.
- Hot files have one owner: after the scaffold no bead edits the root `package.json`,
  `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `eslint.config.js`, `.gitignore`,
  `scripts/check-no-radix.mjs`, `e2e/package.json`, or in `apps/web` the
  `package.json`, `components.json`, `tsconfig.json`, `src/App.tsx`, `src/index.css`,
  `src/components/ui/**`, the i18n store and index files and `src/storage/types.ts`. A new
  dependency, route or screen is a bead of its own, run alone (`DESIGN.md` § 8.4).
- Browser storage keys start with `cacador.`. There are two, `cacador.locale` in
  localStorage and `cacador.recent` in sessionStorage; their names come from
  `apps/web/src/storage/keys.ts`, and nothing outside `apps/web/src/storage/` touches
  IndexedDB.
- Species names in English follow `packages/data/glossary/species.json`, never a
  translator's guess; the validator enforces it once translations exist.
