/**
 * The keyboard focus ring on the app's own links and buttons (DESIGN.md § 8.5):
 * no outline, the forest ring at half strength while focused from the keyboard.
 */
export const FOCUS_RING = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * A plate's box (DESIGN.md § 8.5): card with the hairline, 10 px corners and
 * the plate's padding. Each plate adds its own layout through cn().
 */
export const PLATE = 'rounded-lg border border-line bg-card px-5 pt-4.5 pb-5';

/**
 * A chip (DESIGN.md § 8.5): 36 px tall with the touch target stretched to
 * 44 px; a pressed chip is filled forest. Used on a Button with the outline
 * variant: the flag chips on Practice and the language chips on Settings.
 */
export const CHIP =
  "relative h-9 gap-1.5 px-3 text-[13px] after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-on-fill aria-pressed:hover:bg-forest/90";

/**
 * A card row that links somewhere (DESIGN.md § 8.5): card with the hairline,
 * 8 px corners, at least 44 px tall, the paper colour on hover (on the track
 * the rust percentage would fall to 4.1:1, under the 4.5:1 rule). The weakest
 * topics on Home, and the group and past-exam rows on Progress.
 */
export const ROW_LINK = `flex min-h-11 items-center gap-3 rounded-md border border-line bg-card px-3.5 py-3 text-ink transition-colors hover:bg-paper ${FOCUS_RING}`;
