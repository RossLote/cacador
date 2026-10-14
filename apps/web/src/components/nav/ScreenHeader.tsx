import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FOCUS_RING } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

export type ScreenHeaderProps = { aside?: ReactNode } & (
  | { eyebrow: ReactNode; line?: ReactNode; heading?: ReactNode; title?: never }
  | { title: ReactNode; eyebrow?: never; line?: never; heading?: never }
);

/**
 * The row every screen but Home opens with (DESIGN.md § 8.2, D6): the back
 * control to Home, a 44 px left arrow named "Back to Home", then the caption,
 * then `aside`, what sits at the right of the row, such as the exam's clock.
 * Each page renders its own, so its own data can sit in it. The arrow's target
 * is pulled into the gutter so the glyph lines up with the content under it.
 *
 * The usual caption is `eyebrow` (the section · topic on Practice, the
 * screen's name elsewhere) over an optional `line` in Fraunces 16 px, muted
 * (the question number, "n of 20"); `heading` is then the page's h1 for screen
 * readers only, the header's last child. Progress, Settings, Flagged and the
 * not-found page pass `title` instead: the screen's name as the visible h1 in
 * Fraunces 28 px between the arrow and the right-hand slot, with no eyebrow or
 * line (D10).
 */
export function ScreenHeader({ eyebrow, line, heading, title, aside }: ScreenHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="-ml-2 flex items-center gap-2.5">
      <Link
        to="/"
        aria-label={t.common.backToHome}
        className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-card', FOCUS_RING)}
      >
        <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </Link>
      {title === undefined ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="eyebrow">{eyebrow}</p>
          {line !== undefined && <p className="font-heading text-base text-muted-foreground">{line}</p>}
        </div>
      ) : (
        <h1 className="min-w-0 flex-1 font-heading text-[28px] leading-none font-semibold">{title}</h1>
      )}
      {aside}
      {heading !== undefined && <h1 className="sr-only">{heading}</h1>}
    </header>
  );
}
