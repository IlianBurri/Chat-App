import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_AFTER_MS, watchIdle } from './idle';

describe('watchIdle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports idle after five minutes without input, and active again on input', () => {
    const target = new EventTarget();
    const changes: boolean[] = [];
    const stop = watchIdle((idle) => changes.push(idle), IDLE_AFTER_MS, target);

    vi.advanceTimersByTime(IDLE_AFTER_MS - 30_000);
    target.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(IDLE_AFTER_MS - 30_000);
    expect(changes).toEqual([]);

    vi.advanceTimersByTime(60_000);
    expect(changes).toEqual([true]);

    target.dispatchEvent(new Event('pointermove'));
    target.dispatchEvent(new Event('pointermove'));
    expect(changes).toEqual([true, false]);
    stop();
  });

  it('stops listening when stopped', () => {
    const target = new EventTarget();
    const onChange = vi.fn();
    watchIdle(onChange, 1000, target)();
    vi.advanceTimersByTime(5000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
