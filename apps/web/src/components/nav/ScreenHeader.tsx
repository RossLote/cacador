import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n/useI18n';

interface ScreenHeaderBase {
  /** What sits at the right of the row, such as the exam's clock. */
  aside?: ReactNode;
}

/** The usual header: a caption over an optional line. */
interface ScreenHeaderCaption extends ScreenHeaderBase {
  /** The caption over the line: the section · topic on Practice, the screen's name elsewhere. */
  eyebrow: ReactNode;
  /** The line under it in Fraunces 16 px, muted: the question number, "n of 20". */
  line?: ReactNode;
  title?: never;
}

/** The titled header: the screen's name as the page's h1 in place of the caption and line (Progress, D10). */
interface ScreenHeaderTitled extends ScreenHeaderBase {
  /** The screen's name, rendered as the visible h1 in Fraunces 28 px, with no eyebrow or line. */
  title: ReactNode;
  eyebrow?: never;
  line?: never;
}

export type ScreenHeaderProps = ScreenHeaderCaption | ScreenHeaderTitled;

/**
 * The row every screen but Home opens with (DESIGN.md § 8.2, D6): the back
 * control to Home, a 44 px left arrow named "Back to Home", then the eyebrow
 * over the line, then the right-hand slot. Each page renders its own, so its
 * own data can sit in it. Progress alone passes `title` instead of the eyebrow
 * and line: its name is the visible h1 between the arrow and the readiness at
 * the right (D10). The arrow's target is pulled into the gutter so the
 * glyph lines up with the content under it.
 */
export function ScreenHeader({ eyebrow, line, title, aside }: ScreenHeaderProps) {
  const { t } = useI18n();
  return (
    <header className="-ml-2 flex items-center gap-2.5">
      <Link
        to="/"
        aria-label={t.common.backToHome}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </header>
  );
}
