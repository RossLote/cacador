import { Languages } from 'lucide-react';
import type { PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PeekButtonProps {
  label: string;
  peeking: boolean;
  onPeekChange: (peeking: boolean) => void;
}

/**
 * Press and hold to see the English (DESIGN.md § 6.4): it peeks from pointer
 * down until the pointer is released, cancelled or leaves the button, and is
 * never a toggle. A long press selects no text and opens no context menu, and
 * the button takes no part in scrolling, so the browser never cancels a hold.
 * A press never moves focus to it, so Enter afterwards still belongs to the
 * page (cac-eil.33). Space on a keyboard belongs to the page (D9), which
 * drives the same state.
 */
export function PeekButton({ label, peeking, onPeekChange }: PeekButtonProps) {
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    onPeekChange(true);
  };
  const stop = () => onPeekChange(false);

  return (
    <Button
      type="button"
      variant="secondary"
      data-peeking={peeking || undefined}
      className={cn(
        'h-auto min-h-12 w-full gap-2.5 px-3 py-3 whitespace-normal touch-none select-none [-webkit-touch-callout:none]',
        // Inverted to ink with card text while held (DESIGN.md § 8.6).
        'data-peeking:bg-ink data-peeking:text-card data-peeking:hover:bg-ink',
      )}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onLostPointerCapture={stop}
      onMouseDown={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Languages aria-hidden="true" className="size-5" />
      {label}
    </Button>
  );
}
