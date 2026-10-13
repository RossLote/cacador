#!/usr/bin/env node
// Lint gate: Radix is banned (DESIGN.md § 8; phase 4 D21).
// Fails if pnpm-lock.yaml or apps/web/components.json mentions radix in any
// case, or if components.json does not record the Base UI base.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const LOCKFILE = 'pnpm-lock.yaml';
const COMPONENTS_JSON = 'apps/web/components.json';

const problems = [];

function read(relativePath) {
  try {
    return readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    problems.push(`${relativePath}: cannot read (${error.code ?? error.message})`);
    return null;
  }
}

function checkNoRadix(relativePath, text) {
  text.split('\n').forEach((line, index) => {
    if (/radix/i.test(line)) problems.push(`${relativePath}:${index + 1}: mentions radix: ${line.trim()}`);
  });
}

const lockfile = read(LOCKFILE);
if (lockfile !== null) checkNoRadix(LOCKFILE, lockfile);

const componentsText = read(COMPONENTS_JSON);
if (componentsText !== null) {
  checkNoRadix(COMPONENTS_JSON, componentsText);
  try {
    const { style } = JSON.parse(componentsText);
    // shadcn records the Base UI base in the style name, e.g. "base-nova".
    if (typeof style !== 'string' || !style.startsWith('base-')) {
      problems.push(`${COMPONENTS_JSON}: style is ${JSON.stringify(style)}; expected a Base UI style ("base-…")`);
    }
  } catch (error) {
    problems.push(`${COMPONENTS_JSON}: invalid JSON (${error.message})`);
  }
}

if (problems.length > 0) {
  console.error('check-no-radix: Radix is banned; use shadcn on Base UI.');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('check-no-radix: ok (no radix in pnpm-lock.yaml or components.json; Base UI base recorded)');
