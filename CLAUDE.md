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
runs 20-question, 30-minute mock exams with a pass line at 75 %.

Product rules and the settled decisions live in `DESIGN.md`; where this file and
`DESIGN.md` disagree, `DESIGN.md` § Decision record wins. Work is tracked in beads
(prefix `cac`); the JSONL export in `.beads/issues.jsonl` is committed with every
change because there is no Dolt remote.

This is a personal project: no pull requests, no recorded walkthroughs, no
deployment ceremony. A bead is done when its acceptance holds and `pnpm lint` and
`pnpm test` are green.

## Build & Test

Runtime is Node 26 via nvm (`.nvmrc` holds `26`) and pnpm 11 (`packageManager` in
the root `package.json`). Corepack is not used. The extraction scripts shell out to
`pdftotext` and `pdfimages` from poppler (`brew install poppler`).

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm install
pnpm lint      # eslint + tsc --noEmit in every workspace + the data validator
pnpm test      # vitest in every workspace
pnpm extract   # packages/data: rebuild the question files from the source PDF
pnpm validate  # packages/data: check the question files (also part of lint)
```

Until the scaffold bead lands these scripts do not exist yet; the lines above are
the target it lands.

## Architecture Overview

pnpm workspace. Phase 1 holds one package; the web app arrives in a later phase.

- `packages/data`: the question bank as data. `source/` holds the official PDF and a
  reference parse; `questions/` holds the Portuguese questions in 18 chunk files, one
  section or species group each, never more than 51 questions; `translations/en/` and
  `hints/en/` mirror those file names; `images/` holds the 14 species photos;
  `glossary/` holds species and term lists; `manifest.json` lists sections, topics and
  chunks with their id ranges. `scripts/extract.mjs` and `scripts/validate.mjs` build
  and check it. `src/index.ts` is the typed loader the app will import. The layout and
  shapes are fixed in `DESIGN.md` § 3 and § 4.
- `apps/web` (later): Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui on
  Base UI, installable, offline, progress in IndexedDB. `DESIGN.md` § 6 to § 8.

## Conventions & Patterns

- Portuguese question files are the source of truth and are only ever written by
  `scripts/extract.mjs`; hand edits go into the script's correction table so a rerun
  reproduces them. English and hints are hand-maintained files that mirror the ids.
- A chunk file never spans two sections, and no file holds more than 51 questions.
  Agents work one chunk file at a time; a bead names the files it owns in TOUCHES.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (three days), strict. Never add
  an exclusion; if a version is too new, use the previous one.
- UI components (later) come from shadcn/ui on Base UI. Radix is banned.
- No user-facing text in components; strings live in the i18n messages files, English
  and European Portuguese (`pt-PT`, never Brazilian).
- Browser storage keys start with `cacador.`.
- Species names in English follow `packages/data/glossary/species.json`, never a
  translator's guess; the validator enforces it once translations exist.
