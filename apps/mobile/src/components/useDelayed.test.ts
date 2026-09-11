import { act, renderHook } from '@testing-library/react-native';
import { LOADING_GRACE_MS, useDelayed } from './useDelayed';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDelayed', () => {
  it('stays false while nothing is loading', async () => {
    const { result } = await renderHook(() => useDelayed(false));
    await act(async () => jest.advanceTimersByTime(LOADING_GRACE_MS * 3));
    expect(result.current).toBe(false);
  });

  it('says nothing about a query that answers within the grace period', async () => {
    const { result, rerender } = await renderHook<boolean, { active: boolean }>(
      ({ active }) => useDelayed(active),
      { initialProps: { active: true } },
    );
    await act(async () => jest.advanceTimersByTime(LOADING_GRACE_MS - 20));
    expect(result.current).toBe(false);
    await act(async () => rerender({ active: false }));
    await act(async () => jest.advanceTimersByTime(LOADING_GRACE_MS * 2));
    expect(result.current).toBe(false);
  });

  it('shows the skeleton once the wait is worth mentioning', async () => {
    const { result } = await renderHook(() => useDelayed(true));
    await act(async () => jest.advanceTimersByTime(LOADING_GRACE_MS));
    expect(result.current).toBe(true);
  });

  it('puts it away again when the data lands', async () => {
    const { result, rerender } = await renderHook<boolean, { active: boolean }>(
      ({ active }) => useDelayed(active),
      { initialProps: { active: true } },
    );
    await act(async () => jest.advanceTimersByTime(LOADING_GRACE_MS));
    expect(result.current).toBe(true);
    await act(async () => rerender({ active: false }));
    expect(result.current).toBe(false);
  });
});
