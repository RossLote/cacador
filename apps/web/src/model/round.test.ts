import { describe, expect, it } from 'vitest';
import { parseRoundSize, ROUND_SIZE, roundPath } from './round';

describe('a round of practice', () => {
  it('asks for ten from Home', () => {
    expect(ROUND_SIZE).toBe(10);
    expect(roundPath()).toBe('/practice?round=10');
    expect(roundPath(3)).toBe('/practice?round=3');
  });

  it('reads a whole number of at least one from the query, and nothing else', () => {
    expect(parseRoundSize('10')).toBe(10);
    expect(parseRoundSize('1')).toBe(1);
    expect(parseRoundSize('007')).toBe(7);
    for (const value of [null, '', '0', '-3', '2.5', '1e3', 'ten', ' 10', '99999999999999999999']) {
      expect(parseRoundSize(value), String(value)).toBeUndefined();
    }
  });
});
