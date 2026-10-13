import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLoaded } from './useLoaded';

const resolves = () => Promise.resolve(7);
const rejects = () => Promise.reject(new Error('storage refused'));

describe('useLoaded', () => {
  it('keeps what the load resolved to', async () => {
    const { result } = renderHook(() => useLoaded(resolves));
    await waitFor(() => expect(result.current.data).toBe(7));
    expect(result.current.failed).toBe(false);
  });

  it('reports a rejected load as failed instead of loading for good', async () => {
    const { result } = renderHook(() => useLoaded(rejects));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
