"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

function getSafeNextUrl(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return fallback;

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

export function GoogleAuthButton({
  mode,
  variant = "default",
  defaultNext,
}: {
  mode: "login" | "register";
  variant?: "default" | "auth-btn";

  defaultNext?: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/auth/methods`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const ok =
          json?.data?.googleEnabled === true || json?.googleEnabled === true;
        setEnabled(Boolean(ok));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  const next = getSafeNextUrl(defaultNext ?? "/");
  const href = `${API_URL}/api/v1/auth/google?next=${encodeURIComponent(next)}`;
  const label =
    mode === "register" ? "Đăng ký với Google" : "Đăng nhập với Google";

  if (variant === "auth-btn") {
    return (
      <a
        href={href}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-left font-display text-sm text-white transition-all duration-[var(--dur-base)]",
          "hover:border-cyan/55 hover:bg-cyan/[0.04]",
        )}
      >
        <span className="grid size-[22px] flex-shrink-0 place-items-center rounded bg-white">
          <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z"
            />
          </svg>
        </span>
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] py-3 text-sm text-white transition hover:bg-white/[0.08]"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2.1 1.5-4.7 2.4-7.3 2.4-5.1 0-9.5-3.3-11.2-7.9l-6.5 5C9.5 39.5 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.8 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
        />
      </svg>
      {label}
    </a>
  );
}
