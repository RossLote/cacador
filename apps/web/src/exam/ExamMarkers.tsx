import { useId } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

export interface ExamMarkersProps {
  /** Whether each question, in exam order, has an answer. */
  answered: readonly boolean[];
  /** The index of the question on screen. */
  current: number;
  onJump: (index: number) => void;
}

/**
 * The strip of markers (DESIGN.md § 6.5), one square per question numbered 1
 * to 20: filled once answered, ringed while current. Each jumps to its
 * question. The current one carries aria-current="step", an answered one
 * data-answered="true" and the "Answered" description.
 */
export function ExamMarkers({ answered, current, onJump }: ExamMarkersProps) {
  const { t } = useI18n();
  const answeredId = useId();
  return (
    <nav aria-label={t.exam.markers}>
      <span id={answeredId} hidden>
        {t.exam.answered}
      </span>
      <ol className="grid grid-cols-10 gap-1.5">
        {answered.map((isAnswered, index) => {
          const isCurrent = index === current;
          return (
            <li key={index}>
              <button
                type="button"
                aria-label={t.exam.marker(index + 1)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-describedby={isAnswered ? answeredId : undefined}
                data-answered={isAnswered}
                onClick={() => onJump(index)}
                className={cn(
                  'flex h-9 w-full items-center justify-center rounded-md border text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isAnswered
                    ? 'border-primary bg-primary font-medium text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted dark:border-input dark:bg-input/30',
                  isCurrent && 'ring-2 ring-foreground ring-offset-2 ring-offset-background focus-visible:ring-foreground',
                )}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
