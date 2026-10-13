import type { Hint } from '@cacador/data';
import { useI18n } from '@/i18n/useI18n';

interface HintPanelProps {
  id: string;
  hint: Hint | undefined;
  /** The nudge is part of the panel only once the result is revealed (D23). */
  showNudge: boolean;
}

/** The hint panel (D23): the question's language notes, or a line saying there are none, then the nudge after answering. */
export function HintPanel({ id, hint, showNudge }: HintPanelProps) {
  const { t } = useI18n();
  const card = t.practice.card;
  const notes = hint?.language ?? [];
  const nudge = showNudge ? hint?.nudge : undefined;

  return (
    <section id={id} aria-label={card.hint} lang="en" className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4 text-sm">
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">{card.languageNotes}</h2>
        {notes.length === 0 ? (
          <p className="text-muted-foreground">{card.noLanguageNotes}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={`${note.pt}|${note.en}`} className="flex flex-col gap-0.5">
                <p>
                  <span lang="pt-PT" className="font-semibold">
                    {note.pt}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span>{note.en}</span>
                </p>
                {note.note && <p className="text-muted-foreground">{note.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {nudge && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <h2 className="font-medium">{card.nudge}</h2>
          <p>{nudge}</p>
        </div>
      )}
    </section>
  );
}
