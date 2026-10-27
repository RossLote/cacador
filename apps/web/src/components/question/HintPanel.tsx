import type { Hint } from '@cacador/data';
import type { Ref } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

interface HintPanelProps {
  ref?: Ref<HTMLElement>;
  id: string;
  hint: Hint | undefined;
  /** The nudge is part of the panel only once the result is revealed (D23). */
  showNudge: boolean;
}

/** The panel's eyebrows, in forest (DESIGN.md § 8.6); the words drill's panel takes them too (§ 6.11). */
export const PANEL_HEADING = 'text-xs/4 font-semibold tracking-[0.14em] text-forest uppercase';

/** The panel's box: a moss-tint block with no border, 10 px corners and ink text, which the words drill's panel shares. */
export const PANEL = 'flex flex-col gap-3 rounded-lg bg-moss px-4.5 py-4 text-[15px]/[1.4] text-ink';

/** Under a rule in the panel: the moss-line hairline over the part (the nudge, the words drill's question). */
export const PANEL_RULE = 'border-t border-moss-line pt-3';

/**
 * The hint panel (D23): the question's language notes, or a line saying there
 * are none, then the nudge after answering. The headings follow the interface;
 * the hint text is English (hints/en) and marked so. The plate is a moss-tint
 * block with no border; each note's Portuguese is in Fraunces, its English in
 * the eyebrow colour, and the nudge sits under a moss-line rule.
 */
export function HintPanel({ ref, id, hint, showNudge }: HintPanelProps) {
  const { t } = useI18n();
  const card = t.practice.card;
  const notes = hint?.language ?? [];
  const nudge = showNudge ? hint?.nudge : undefined;

  return (
    <section ref={ref} id={id} aria-label={card.hint} className={PANEL}>
      <div className="flex flex-col gap-3">
        <h2 className={PANEL_HEADING}>{card.languageNotes}</h2>
        {notes.length === 0 ? (
          <p className="text-eyebrow">{card.noLanguageNotes}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={`${note.pt}|${note.en}`} className="flex flex-col gap-0.5">
                <p>
                  <span lang="pt-PT" className="font-heading font-semibold">
                    {note.pt}
                  </span>
                  <span className="text-eyebrow"> · </span>
                  <span lang="en" className="text-eyebrow">
                    {note.en}
                  </span>
                </p>
                {note.note && <p lang="en">{note.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {nudge && (
        <div className={cn('flex flex-col gap-1.5', PANEL_RULE)}>
          <h2 className={PANEL_HEADING}>{card.nudge}</h2>
          <p lang="en" className="text-[15px]/[1.45]">
            {nudge}
          </p>
        </div>
      )}
    </section>
  );
}
