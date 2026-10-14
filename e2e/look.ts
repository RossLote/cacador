import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The Campo tokens (DESIGN.md § 8.5) as getComputedStyle reports them, for the colour checks of the acceptance bar
 * (epic cac-8cn). Light, then the dark values the bar's dark step reads.
 */
export const LIGHT = {
  paper: 'rgb(244, 240, 230)',
  ink: 'rgb(28, 38, 32)',
  forest: 'rgb(46, 90, 58)',
  moss: 'rgb(221, 232, 218)',
  rust: 'rgb(181, 70, 28)',
  clay: 'rgb(243, 222, 210)',
} as const;

export const DARK = {
  paper: 'rgb(21, 26, 23)',
  card: 'rgb(28, 35, 32)',
  ink: 'rgb(237, 232, 219)',
  muted: 'rgb(179, 186, 174)',
  rust: 'rgb(224, 120, 79)',
} as const;

/** WCAG's floor for body text, which every text colour on its ground passes (D2). */
export const TEXT_CONTRAST = 4.5;

function channels(colour: string): [number, number, number] {
  const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(colour);
  if (!match) throw new Error(`not an rgb colour: ${colour}`);
  if (match[4] !== undefined && Number(match[4]) !== 1) throw new Error(`a translucent colour: ${colour}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** WCAG 2 relative luminance of an rgb() colour. */
function luminance(colour: string): number {
  const [r, g, b] = channels(colour).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two rgb() colours. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export const textColour = (locator: Locator): Promise<string> => locator.evaluate((element) => getComputedStyle(element).color);
export const background = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

/**
 * The colour `locator`'s text sits on, which the contrast rule of DESIGN.md § 8.5 measures against: the background of
 * the element itself or of its nearest ancestor whose background is not transparent (a plate, a card, else the body).
 */
export const ground = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const colour = getComputedStyle(node).backgroundColor;
      if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') return colour;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  });

/**
 * `element` is set in Fraunces and the page has the face: its computed family leads with Fraunces, a Fraunces face
 * has loaded, and document.fonts.check finds nothing of it left to load.
 */
export async function expectFraunces(page: Page, element: Locator) {
  await expect(element).toHaveCSS('font-family', /^Fraunces,/);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
        const loaded = [...document.fonts].some((face) => face.family.replace(/"/g, '') === 'Fraunces' && face.status === 'loaded');
        return loaded && document.fonts.check('600 16px Fraunces');
      }),
    )
    .toBe(true);
}
