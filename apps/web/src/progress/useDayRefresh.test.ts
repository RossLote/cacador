import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDayRefresh } from './useDayRefresh';

describe('useDayRefresh', () => {
  it('refreshes at each local midnight while mounted, and no more once unmounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 13, 23, 59));
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useDayRefresh(refresh));

    vi.advanceTimersByTime(59 * 1000);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(refresh).toHaveBeenCalledTimes(2);

    unmount();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes when the page becomes visible, not when it is hidden', () => {
    const refresh = vi.fn();
    const state = vi.spyOn(document, 'visibilityState', 'get');
    renderHook(() => useDayRefresh(refresh));

    state.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).not.toHaveBeenCalled();

    state.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
