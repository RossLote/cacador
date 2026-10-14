import { describe, expect, it } from 'vitest';
import { READINESS_TARGET_PERCENT } from '@/model';
import { percentTone } from './groups';

describe('percentTone', () => {
  it('draws the 75 % line at 75: rust at 74, forest at 75 and 76', () => {
    expect(READINESS_TARGET_PERCENT).toBe(75);
    expect(percentTone(74)).toBe('rust');
    expect(percentTone(75)).toBe('forest');
    expect(percentTone(76)).toBe('forest');
  });

  it('is rust at 0 and forest at 100', () => {
    expect(percentTone(0)).toBe('rust');
    expect(percentTone(100)).toBe('forest');
  });
});
