import { useId } from 'react';
import { FOCUS_RING } from '@/components/styles';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

interface ExamMarkersProps {
  /** Whether each question, in exam order, has an answer. */
  answered: readonly boolean[];
  /** The index of the question on screen. */
  current: number;
  onJump: (index: number) => void;
}

/** What a marker shows: the current question over its answer, then answered or not. */
type MarkerState = 'current' | 'answered' | 'unanswered';

/** The fill of each state (D9): current rust, answered forest, both with card text; unanswered card with the hairline. */
const LOOK: Record<MarkerState, string> = {
  current: 'border-rust bg-rust text-on-fill',
  answered: 'border-forest bg-forest text-on-fill hover:bg-forest/90',
  unanswered: 'border-line bg-card text-muted-foreground hover:bg-track',
};

/**
 * The markers (DESIGN.md § 6.5, D9): a 10-column grid of numbered 28 px
 * squares, so 20 wrap onto two rows and never scroll. Each jumps to its
 * question. The current one carries aria-current="step", an answered one
 * data-answered="true" and the "Answered" description; data-state names the
 * look drawn.
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
          const state: MarkerState = isCurrent ? 'current' : isAnswered ? 'answered' : 'unanswered';
          return (
            <li key={index}>
              <button
                type="button"
                aria-label={t.exam.marker(index + 1)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-describedby={isAnswered ? answeredId : undefined}
                data-answered={isAnswered}
                data-state={state}
                onClick={() => onJump(index)}
                className={cn(
                  'flex h-7 w-full min-w-0 items-center justify-center rounded-sm border p-0 text-xs font-semibold tabular-nums transition-colors',
                  FOCUS_RING,
                  LOOK[state],
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
