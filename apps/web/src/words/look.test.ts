// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The app's stylesheet as written: vitest hands CSS imports to tests empty, so it is read from disk. */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

/** The Campo tokens a stretch of index.css sets, by name; the first value of each name wins. */
function tokensIn(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name, hex] of block.matchAll(/--campo-([\w-]+):\s*(#[0-9a-f]{6})/gi)) {
    if (!tokens.has(name!)) tokens.set(name!, hex!.toLowerCase());
  }
  return tokens;
}

/** Where the dark block opens (the custom variant near the top names the same query, without a brace). */
const darkAt = css.indexOf('@media (prefers-color-scheme: dark) {');
const THEMES = { light: tokensIn(css.slice(0, darkAt)), dark: tokensIn(css.slice(darkAt)) };

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Every text and fill pairing the words drill and Home's Words card put on
 * screen (DESIGN.md § 6.11, § 8.5), as token pairs: what is drawn, its colour,
 * the colour under it, and the ratio the rule asks (4.5:1 for text, 3:1 for
 * the cross icon, which is not text).
 */
const PAIRINGS: readonly (readonly [string, string, string, number])[] = [
  ['the word, the counter and the option text on the ground', 'ink', 'paper', 4.5],
  ['the phrase under the word', 'muted', 'paper', 4.5],
  ['the screen header eyebrow', 'eyebrow', 'paper', 4.5],
  ['an option row', 'ink', 'card', 4.5],
  ['a right or correct row and the panel text', 'ink', 'moss', 4.5],
  ['"Right" and the panel heading', 'forest', 'moss', 4.5],
  ['the forest-filled letter', 'on-fill', 'forest', 4.5],
  ['a wrong row, "Wrong" and a missed score row with "Missed"', 'ink', 'clay', 4.5],
  ['the cross on clay', 'rust', 'clay', 3],
  ['the rust-filled letter, Next, Finish and Another 10', 'on-fill', 'rust', 4.5],
  ['the score caption', 'eyebrow', 'card', 4.5],
  ['the count right and a score row', 'ink', 'card', 4.5],
  ['"of 10 right" and the Words card line', 'muted', 'card', 4.5],
  ['the Words card on hover', 'ink', 'track', 4.5],
  ['the Words card line on hover', 'muted', 'track', 4.5],
];

describe('the words drill look (DESIGN.md § 8.5 contrast)', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`reads every Campo token in the ${theme} theme`, () => {
      for (const name of ['paper', 'card', 'track', 'ink', 'muted', 'eyebrow', 'forest', 'moss', 'rust', 'clay', 'on-fill']) {
        expect(tokens.get(name), name).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(tokens.get('paper')).toBe(theme === 'light' ? '#f4f0e6' : '#151a17');
    });

    for (const [what, text, ground, least] of PAIRINGS) {
      it(`passes ${least}:1 for ${what}, ${text} on ${ground}, in the ${theme} theme`, () => {
        expect(contrast(tokens.get(text)!, tokens.get(ground)!)).toBeGreaterThanOrEqual(least);
      });
    }
  }
});
