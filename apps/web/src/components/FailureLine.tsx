import type { ReactNode } from 'react';

/** The one line a screen uses to say something did not work (DESIGN.md § 6.9), announced as a status. */
export function FailureLine({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-destructive">
      {children}
    </p>
  );
}
