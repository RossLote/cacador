import { ChevronRight, Flag } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FOCUS_RING } from '@/components/styles';
import { cn } from '@/lib/utils';

/** The row linking to Flagged, at the foot of Progress and Settings: the flag icon, the label, then a chevron. */
export function FlaggedLink({ children }: { children: ReactNode }) {
  return (
    <Link
      to="/flagged"
      className={cn(
        'flex min-h-12 items-center gap-2.5 rounded-md border border-ink px-3.5 py-3 text-base font-semibold text-ink transition-colors hover:bg-card',
        FOCUS_RING,
      )}
    >
      <Flag aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
      <span className="flex-1">{children}</span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
    </Link>
  );
}
