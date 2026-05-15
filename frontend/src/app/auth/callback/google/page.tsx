"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <GoogleCallbackInner />
    </Suspense>
  );
}

function CallbackFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan" />
      <p className="text-sm text-white/70">Đang tải…</p>
    </div>
  );
}

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const next = safeRedirectPath(searchParams.get("next"));
    void (async () => {
      try {
        localStorage.setItem("hasSession", "1");
        const refreshRes = await api.post<{
          data: { accessToken: string };
        }>("/auth/refresh");
        const accessToken = refreshRes.data.data.accessToken;
        const meRes = await api.get<{
          data: {
            id: string;
            email: string;
            name: string | null;
            role: "ADMIN" | "CUSTOMER";
          };
        }>("/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const me = meRes.data.data;
        login(
          {
            id: me.id,
            email: me.email,
            name: me.name ?? undefined,
            role: me.role,
          },
          accessToken,
        );
        router.replace(next);
      } catch {
        localStorage.removeItem("hasSession");
        setError(true);

        setTimeout(
          () => router.replace("/login?oauth_error=callback_failed"),
          1500,
        );
      }
    })();
  }, [router, searchParams, login]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      {error ? (
        <p className="text-sm text-red-400">Không thể đăng nhập. Đang tải…</p>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-cyan" />
          <p className="text-sm text-white/70">Đang xử lý…</p>
        </>
      )}
    </div>
  );
}
