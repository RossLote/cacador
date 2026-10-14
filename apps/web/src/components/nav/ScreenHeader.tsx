import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/i18n/useI18n';

export interface ScreenHeaderProps {
  /** The caption over the line: the section · topic on Practice, the screen's name elsewhere. */
  eyebrow: ReactNode;
  /** The line under it in Fraunces 16 px, muted: the question number, "n of 20", "N % · M unseen". */
  line?: ReactNode;
  /** What sits at the right of the row, such as the exam's clock. */
  aside?: ReactNode;
}

/**
 * The row every screen but Home opens with (DESIGN.md § 8.2, D6): the back
 * control to Home, a 44 px left arrow named "Back to Home", then the eyebrow
 * over the line, then the right-hand slot. Each page renders its own, so its
 * own data can sit in it. The arrow's target is pulled into the gutter so the
 * glyph lines up with the content under it.
 */
export function ScreenHeader({ eyebrow, line, aside }: ScreenHeaderProps) {
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
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="eyebrow">{eyebrow}</p>
        {line !== undefined && <p className="font-heading text-base text-muted-foreground">{line}</p>}
      </div>
      {aside}
    </header>
  );
}
