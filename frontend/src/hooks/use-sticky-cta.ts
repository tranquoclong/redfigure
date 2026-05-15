'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useStickyCta<T extends Element = HTMLElement>(opts?: {
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const refCallback = useCallback(
    (node: T | null) => {
      nodeRef.current = node;

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;
      if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return;
      }

      const obs = new IntersectionObserver(
        ([entry]) => setIsVisible(entry.isIntersecting),
        {
          threshold: opts?.threshold ?? 0.25,
          rootMargin: opts?.rootMargin ?? '0px',
        },
      );
      obs.observe(node);
      observerRef.current = obs;
    },
    [opts?.threshold, opts?.rootMargin],
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return {
    ref: refCallback,
    getNode: () => nodeRef.current,
    isVisible,
  } as const;
}
