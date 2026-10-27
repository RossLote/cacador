/**
 * The keyboard focus ring on the app's own links and buttons (DESIGN.md § 8.5):
 * no outline, the forest ring at half strength while focused from the keyboard.
 */
export const FOCUS_RING = 'outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * The hover of a rust fill (DESIGN.md § 8.5): the rust with a tenth of ink
 * mixed in, opaque, so it never shows the ground through. The on-fill text
 * measures 5.77:1 on it in light and 6.40:1 in dark; rust at 90 % over paper
 * fell to 4.37:1 in light, under the 4.5:1 rule. The default Button and Badge
 * write the same mix with the primary token, which is the rust.
 */
export const RUST_HOVER = 'hover:bg-[color-mix(in_srgb,var(--color-rust)_90%,var(--color-ink))]';

/**
 * A plate's box (DESIGN.md § 8.5): card with the hairline, 10 px corners and
 * the plate's padding. Each plate adds its own layout through cn().
 */
export const PLATE = 'rounded-lg border border-line bg-card px-5 pt-4.5 pb-5';

/**
 * A chip (DESIGN.md § 8.5, D4): 36 px tall with the touch target stretched to
 * 44 px, and the 6 px chip corners a Badge chip has too; a pressed chip is
 * filled forest. Used on a Button with the outline variant: the flag chips on
 * Practice and the language chips on Settings.
 */
export const CHIP =
  "relative h-9 gap-1.5 rounded-sm px-3 text-[13px] after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-on-fill aria-pressed:hover:bg-forest/90";

/**
 * A card row that links somewhere (DESIGN.md § 8.5): card with the hairline,
 * 8 px corners, at least 44 px tall, the paper colour on hover (on the track
 * the rust percentage would fall to 4.1:1, under the 4.5:1 rule). The weakest
 * topics on Home, and the group and past-exam rows on Progress.
 */
export const ROW_LINK = `flex min-h-11 items-center gap-3 rounded-md border border-line bg-card px-3.5 py-3 text-ink transition-colors hover:bg-paper ${FOCUS_RING}`;

/**
 * The moss panel (DESIGN.md § 8.6): a moss-tint block with no border, 10 px
 * corners and ink text. The hint panel, and the words drill's panel after
 * answering (§ 6.11).
 */
export const MOSS_PANEL = 'flex flex-col gap-3 rounded-lg bg-moss px-4.5 py-4 text-[15px]/[1.4] text-ink';

/** A moss panel's eyebrows, in forest (DESIGN.md § 8.6). */
export const MOSS_PANEL_HEADING = 'text-xs/4 font-semibold tracking-[0.14em] text-forest uppercase';

/** Under a rule in a moss panel: the moss-line hairline over the part (the nudge, the words drill's question). */
export const MOSS_PANEL_RULE = 'border-t border-moss-line pt-3';
