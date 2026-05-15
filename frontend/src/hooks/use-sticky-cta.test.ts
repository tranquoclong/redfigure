import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStickyCta } from './use-sticky-cta';

describe('useStickyCta', () => {
  let observe: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let lastCallback:
    | ((entries: IntersectionObserverEntry[]) => void)
    | undefined;

  beforeEach(() => {
    observe = vi.fn();
    disconnect = vi.fn();
    lastCallback = undefined;

    class MockIntersectionObserver {
      constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
        lastCallback = cb;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn();
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    delete (globalThis as { IntersectionObserver?: unknown })
      .IntersectionObserver;
  });

  it('default isVisible=true without ref attached (SSR-safe)', () => {
    const { result } = renderHook(() => useStickyCta());
    expect(result.current.isVisible).toBe(true);
    expect(observe).not.toHaveBeenCalled();
  });

  it('attach via callback ref triggers observer.observe', () => {
    const { result } = renderHook(() => useStickyCta<HTMLDivElement>());
    const node = document.createElement('div');
    result.current.ref(node);
    expect(observe).toHaveBeenCalledWith(node);
    expect(result.current.getNode()).toBe(node);
  });

  it('detach (ref(null)) calls disconnect and clears node', () => {
    const { result } = renderHook(() => useStickyCta<HTMLDivElement>());
    const node = document.createElement('div');
    result.current.ref(node);
    expect(observe).toHaveBeenCalledTimes(1);

    result.current.ref(null);
    expect(disconnect).toHaveBeenCalled();
    expect(result.current.getNode()).toBeNull();
  });

  it('cleanup unmount calls disconnect even without manual detach', () => {
    const { result, unmount } = renderHook(() => useStickyCta());
    const node = document.createElement('div');
    result.current.ref(node);
    disconnect.mockClear();
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('observer callback updates isVisible', () => {
    const { result, rerender } = renderHook(() => useStickyCta());
    const node = document.createElement('div');
    result.current.ref(node);

    lastCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    rerender();
    expect(result.current.isVisible).toBe(false);

    lastCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    rerender();
    expect(result.current.isVisible).toBe(true);
  });
});
