import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DayAccuracy } from '@/model';
import { DayBars } from './DayBars';

const day = (n: number, total: number, correct: number): DayAccuracy => {
  const start = new Date(2026, 9, n).getTime();
  return { date: `2026-10-${String(n).padStart(2, '0')}`, start, total, correct };
};

const bars = () => within(screen.getByRole('list')).getAllByRole('img');
const blocks = (bar: HTMLElement) => Array.from(bar.children) as HTMLElement[];

describe('DayBars', () => {
  it('sizes a bar by its day against the busiest, wrong block under the right block by their counts', () => {
    // Oct 10 empty, Oct 11 4 answers 4 right, Oct 12 2 answers 0 right, Oct 13 (today) 5 answers 3 right.
    render(<DayBars days={[day(10, 0, 0), day(11, 4, 4), day(12, 2, 0), day(13, 5, 3)]} />);
    const [empty, allRight, allWrong, today] = bars() as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];

    // 5 answers, 3 right: the track (wrong) block first with 2 parts, then the right block with 3, in rust for today.
    expect(today).toHaveStyle({ height: '100%' });
    const [wrong, right, ...rest] = blocks(today) as [HTMLElement, HTMLElement];
    expect(rest).toHaveLength(0);
    expect(wrong).toHaveClass('bg-track');
    expect(wrong.style.flexGrow).toBe('2');
    expect(right).toHaveAttribute('data-slot', 'day-right');
    expect(right).toHaveClass('bg-rust');
    expect(right).not.toHaveClass('bg-forest');
    expect(right.style.flexGrow).toBe('3');

    // An earlier day with answers: forest, and its height is its share of the busiest day's.
    expect(allRight).toHaveStyle({ height: '80%' });
    expect(allRight).toHaveClass('min-h-1');
    const [only, ...none] = blocks(allRight);
    expect(none).toHaveLength(0);
    expect(only).toHaveAttribute('data-slot', 'day-right');
    expect(only).toHaveClass('bg-forest');
    expect((only as HTMLElement).style.flexGrow).toBe('4');

    // A day of wrong answers only has the track block and no right block.
    expect(allWrong).toHaveStyle({ height: '40%' });
    const [track, ...noRight] = blocks(allWrong);
    expect(noRight).toHaveLength(0);
    expect(track).toHaveClass('bg-track');
    expect((track as HTMLElement).style.flexGrow).toBe('2');

    // A day with no answers draws no block, no minimum height and no height.
    expect(blocks(empty)).toHaveLength(0);
    expect(empty).not.toHaveClass('min-h-1');
    expect(empty).toHaveStyle({ height: '0%' });
  });
});
